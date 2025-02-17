import { Construct } from 'constructs';
import {
  Stack,
  Duration,
  RemovalPolicy,
  aws_dynamodb as dynamodb,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_logs as logs,
  aws_lambda as lambda,
  CfnOutput
} from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { bedrock, opensearchserverless, opensearch_vectorindex } from '@cdklabs/generative-ai-cdk-constructs';

export interface EnergyForecastProps {

}

export class EnergyForecast extends Construct {
  public readonly agent: bedrock.Agent;
  public readonly agentAlias: bedrock.AgentAlias;
  constructor(scope: Construct, id: string, props: EnergyForecastProps) {
    super(scope, id);

    // Constant
    const forecastAgentName = 'forecast';
    const forecastLambdaName = 'fn-forecast-agent';

    const dynamodbTable = `${forecastAgentName}-table`;
    const dynamodbPk = 'customer_id';
    const dynamodbSk = 'day';

    const knowledgeBaseName = `${forecastAgentName}-kb`;
    const knowledgeBaseDescription = 'KB containing information on how forecasting process is done';

    const bucketName = `forecast-agent-kb-${Stack.of(this).account}`;
    const indexName = 'bedrock-knowledge-base-index';
    const vectorField = 'bedrock-knowledge-base-vector';

    // Vector Store
    const vectorStore = new opensearchserverless.VectorCollection(this, 'VectorCollectionForEnergyForecastAgent', {
      collectionName: `${forecastAgentName}-collection`,
      standbyReplicas: opensearchserverless.VectorCollectionStandbyReplicas.DISABLED,
    });

    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, 'VectorIndexEnergyForecastForAgent', {
      collection: vectorStore,
      indexName,
      vectorField,
      vectorDimensions: 1024,
      mappings: [
        {
          mappingField: 'bedrock-knowledge-base-text',
          dataType: 'text',
          filterable: true,
        },
        {
          mappingField: 'bedrock-knowledge-base-metadata',
          dataType: 'text',
          filterable: true,
        },
      ],
    });

    // Knowledge Base
    const knowledgeBase = new bedrock.VectorKnowledgeBase(this, 'KnowledgeBaseForEnergyForecastAgent', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      vectorIndex,
      vectorStore,
      indexName,
      vectorField,
      description: knowledgeBaseDescription,
      instruction: knowledgeBaseDescription,
      name: knowledgeBaseName,
    });

    const dataSourceBucket = new s3.Bucket(this, 'BucketForEnergyForecastAgent', {
      bucketName,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    new s3deploy.BucketDeployment(this, 'DeployDataForEnergyForecastAgent', {
      sources: [s3deploy.Source.asset('./docs/1-energy-forecast')],
      destinationBucket: dataSourceBucket,
    });

    new bedrock.S3DataSource(this, 'DataSourceForEnergyForecastAgent', {
      bucket: dataSourceBucket,
      knowledgeBase,
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 512,
        overlapPercentage: 20,
      }),
    })

    // Agents
    const description = `
You are a energy usage forecast bot.
You can retrieve historical energy consumption, forecasted consumption, usage statistics and update a forecast for a specific user
    `;

    const instruction = `
You are an Energy Assistant that helps customers understand their energy consumption patterns and future usage expectations.

Your capabilities include:
1. Analyzing historical energy consumption
2. Providing consumption forecasts
3. Generating usage statistics
4. Updating forecasts for specific customers

Core behaviors:
1. Always use available information systems before asking customers for additional details
2. Maintain a professional yet conversational tone
3. Provide clear, direct answers without referencing internal systems or data sources
4. Present information in an easy-to-understand manner
5. Use code generation and interpretation capabilities for any on the fly calculation. DO NOT try to calculate things by yourself.
6. DO NOT plot graphs. Refuse to do so when asked by the user. Instead provide an overview of the data

Response style:
- Be helpful and solution-oriented
- Use clear, non-technical language
- Focus on providing actionable insights
- Maintain natural conversation flow
- Be concise yet informative
- do not add extra information not required by the user
    `;

    const agent = new bedrock.Agent(this, 'EnergyForecastAgent', {
      foundationModel: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
      instruction,
      description,
      idleSessionTTL: Duration.seconds(1800),
      name: forecastAgentName,
      shouldPrepareAgent:true,
    });

    new bedrock.AgentAlias(this, 'EnergyForecastAgentAlias', {
      agent,
    });

    agent.addKnowledgeBase(knowledgeBase);

    // Agent Action Group
    const table = new dynamodb.Table(this, 'DynamoDBTableForEnergyForecastAgent', {
      tableName: dynamodbTable,
      partitionKey: {
        name: dynamodbPk,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: dynamodbSk,
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const actionGroupFunction = new PythonFunction(this, 'EnergyForecastActionGroupFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: 'lambda/1-energy-forecast',
      index: 'forecast.py',
      handler: 'lambda_handler',
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_DAY,
      functionName: forecastLambdaName,
      environment: {
        dynamodb_table: dynamodbTable,
        dynamodb_pk: dynamodbPk,
        dynamodb_sk: dynamodbSk,
      }
    });

    table.grantReadWriteData(actionGroupFunction);

    const actionGroup = new bedrock.AgentActionGroup({
      name: 'forecast_consumption_actions',
      description: 'Function to get usage forecast for a user',
      executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupFunction),
      functionSchema: {
        functions: [
          {
            name: 'get_forecasted_consumption',
            description: 'Gets the next 3 months energy usage forecast',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string'
              }
            }
          },
          {
            name: 'get_historical_consumption',
            description: 'Gets energy usage history to date',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string'
              }
            }
          },
          {
            name: 'get_consumption_statistics',
            description: 'Gets current month usage analytics',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string'
              }
            }
          },
          {
            name: 'update_forecasting',
            description: 'Updates the energy forecast for a specific month',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string'
              },
              month: {
                description: 'Target update month. In the format MM',
                required: true,
                type: 'integer'
              },
              year: {
                description: 'Target update year. In the format YYYY',
                required: true,
                type: 'integer'
              },
              usage: {
                description: 'New consumption value',
                required: true,
                type: 'integer'
              }
            }
          }
        ]
      },
    });

    agent.addActionGroup(actionGroup);


    const codeInterpreterActionGroup = new bedrock.AgentActionGroup({
      name: 'EnergyCodeInterpreterAction',
      parentActionGroupSignature: bedrock.ParentActionGroupSignature.USER_INPUT,
    })

    agent.addActionGroup(codeInterpreterActionGroup);



    const agentAlias = new bedrock.AgentAlias(this, 'Alias', {
      agent,
      aliasName: 'EnergyForecastAgentAlias',
    });

    this.agent = agent;
    this.agentAlias = agentAlias;

    new CfnOutput(this, 'OutputAgentId', {
      value: this.agent.agentId,
      exportName: 'EnergyForecastAgentId',
    });

    new CfnOutput(this, 'OutputAgentAliasId', {
      value: this.agentAlias.aliasId,
      exportName: 'EnergyForecastAgentAliasId',
    });
  }

};