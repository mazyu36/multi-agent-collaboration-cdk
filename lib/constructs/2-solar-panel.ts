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

export interface SolarPanelProps {

}

export class SolarPanel extends Construct {
  public readonly agent: bedrock.Agent;
  public readonly agentAlias: bedrock.AgentAlias;
  constructor(scope: Construct, id: string, props: SolarPanelProps) {
    super(scope, id);

    // Constant
    const solarPanelAgentName = 'solar-panel';
    const solarPanelLambdaName = 'fn-solar-panel-agent';

    const dynamodbTable = `${solarPanelAgentName}-table`;
    const dynamodbPk = 'customer_id';
    const dynamodbSk = 'ticket_id';

    const knowledgeBaseName = `${solarPanelAgentName}-kb`;
    const knowledgeBaseDescription = 'KB containing solar panel instructions for installation and maintenance';

    const bucketName = `solar-panel-agent-kb-${Stack.of(this).account}`;
    const indexName = 'bedrock-knowledge-base-index';
    const vectorField = 'bedrock-knowledge-base-vector';

    // Vector Store
    const vectorStore = new opensearchserverless.VectorCollection(this, 'VectorCollectionForSolarPanelAgent', {
      collectionName: `${solarPanelAgentName}-collection`,
      standbyReplicas: opensearchserverless.VectorCollectionStandbyReplicas.DISABLED,
    });

    const vectorIndex = new opensearch_vectorindex.VectorIndex(this, 'VectorIndexSolarPanelForAgent', {
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
    const knowledgeBase = new bedrock.VectorKnowledgeBase(this, 'KnowledgeBaseForSolarPanelAgent', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      vectorIndex,
      vectorStore,
      indexName,
      vectorField,
      description: knowledgeBaseDescription,
      instruction: knowledgeBaseDescription,
      name: knowledgeBaseName,
    });

    const dataSourceBucket = new s3.Bucket(this, 'BucketForSolarPanelAgent', {
      bucketName,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    new s3deploy.BucketDeployment(this, 'DeployDataForSolarPanelAgent', {
      sources: [s3deploy.Source.asset('./docs/2-solar-panel')],
      destinationBucket: dataSourceBucket,
    });

    new bedrock.S3DataSource(this, 'DataSourceForSolarPanelAgent', {
      bucket: dataSourceBucket,
      knowledgeBase,
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 512,
        overlapPercentage: 20,
      }),
    })

    // Agents
    const description = `
You are a solar energy helper bot.
You can retrieve information on how to install and do maintenance on solar panels
    `;

    const instruction = `
You are a Solar Energy Assistant that helps customers with solar panel installation and maintenance guidance.

Your capabilities include:
1. Providing installation instructions
2. Offering maintenance procedures
3. Troubleshooting common issues
4. Creating support tickets for specialist assistance

Core behaviors:
1. Always use available information before asking customers for additional details
2. Maintain a professional yet approachable tone
3. Provide clear, direct answers
4. Present technical information in an easy-to-understand manner

Support ticket protocol:
- Only generate tickets for specialist-level issues
- Respond exclusively with case ID when creating tickets
- Decline providing specialist advice beyond your scope

Response style:
- Be helpful and solution-oriented
- Use clear, practical language
- Focus on actionable guidance
- Maintain natural conversation flow
- Be concise yet informative
- Do not add extra information not required by the user
    `;

    const agent = new bedrock.Agent(this, 'SolarPanelAgent', {
      foundationModel: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
      instruction,
      description,
      idleSessionTTL: Duration.seconds(1800),
      name: solarPanelAgentName,
      shouldPrepareAgent: true,
    });
    this.agent = agent;

    this.agentAlias=new bedrock.AgentAlias(this, 'SolarPanelAgentAlias', {
      agent,
    });

    agent.addKnowledgeBase(knowledgeBase);

    // Agent Action Group
    const table = new dynamodb.Table(this, 'DynamoDBTableForSolarPanelAgent', {
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

    const actionGroupFunction = new PythonFunction(this, 'SolarPanelActionGroupFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: 'lambda/2-solar-panel',
      index: 'solar_energy.py',
      handler: 'lambda_handler',
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_DAY,
      functionName: solarPanelLambdaName,
      environment: {
        dynamodb_table: dynamodbTable,
        dynamodb_pk: dynamodbPk,
        dynamodb_sk: dynamodbSk,
      }
    });

    table.grantReadWriteData(actionGroupFunction);

    const actionGroup = new bedrock.AgentActionGroup({
      name: 'solar_energy_actions',
      description: 'Function to open an energy ticket for a user or get status from an opened ticket',
      executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupFunction),
      functionSchema: {
        functions: [
          {
            name: 'open_ticket',
            description: 'Create a ticket to get help with information related with solar panel or clean energy',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string',
              },
              msg: {
                description: 'The reason why customer is opening a ticket',
                required: true,
                type: 'string',
              }
            }
          },
          {
            name: 'get_ticket_status',
            description: 'get the status of an existing ticket',
            parameters: {
              customer_id: {
                description: 'Unique customer identifier',
                required: true,
                type: 'string',
              },
              ticket_id: {
                description: 'Unique ticket identifier',
                required: false,
                type: 'string',
              }
            }
          }
        ]
      },
    });

    agent.addActionGroup(actionGroup);


    const codeInterpreterActionGroup = new bedrock.AgentActionGroup({
      name: 'SolarCodeInterpreterAction',
      parentActionGroupSignature: bedrock.ParentActionGroupSignature.USER_INPUT,
    })

    agent.addActionGroup(codeInterpreterActionGroup);

    new CfnOutput(this, 'OutputAgentId', {
      value: this.agent.agentId,
      exportName: 'SolarPanelAgentId',
    });

    new CfnOutput(this, 'OutputAgentAliasId', {
      value: this.agentAlias.aliasId,
      exportName: 'SolarPanelAgentAliasId',
    });
  }

};