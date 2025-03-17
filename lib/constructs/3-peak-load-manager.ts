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
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';

export interface PeakLoadManagerProps {

}

export class PeakLoadManager extends Construct {
  public readonly agent: bedrock.Agent;
  public readonly agentAlias: bedrock.AgentAlias;
  constructor(scope: Construct, id: string, props: PeakLoadManagerProps) {
    super(scope, id);

    // Constant
    const peakLoadManagerAgentName = 'peak-load-manager';
    const peakLoadManagerLambdaName = 'fn-peak-load-manager-agent';

    const dynamodbTable = `${peakLoadManagerAgentName}-table`;
    const dynamodbPk = 'customer_id';
    const dynamodbSk = 'item_id';

    // Agents
    const description = `You are a peak load manager bot.
You can retrieve information from IoT devices, identify process and their peak energy consumption and suggest shifts to off-peak hours.`;

    const instruction = `You are a Peak Load Manager Bot that optimizes energy consumption patterns
by analyzing IoT device data and process schedules.

Your capabilities include:
1. Retrieving data from IoT devices
2. Identifying non-essential loads during peak hours and reallocating them to other schedules
3. Recommending schedule adjustments

Response style:
- Be precise and analytical
- Use clear, practical language
- Focus on actionable recommendations
- Support suggestions with data
- Be concise yet thorough
- Do not request information that can be retrieved from IoT devices`;

    const agent = new bedrock.Agent(this, 'PeakLoadManagerAgent', {
      foundationModel: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
      instruction,
      description,
      idleSessionTTL: Duration.seconds(1800),
      name: peakLoadManagerAgentName,
      shouldPrepareAgent: true,
    });
    this.agent = agent;

    this.agentAlias = new bedrock.AgentAlias(this, 'PeakLoadManagerAgentAlias', {
      agent,
    });

    // Agent Action Group
    const table = new dynamodb.Table(this, 'DynamoDBTableForPeakLoadManagerAgent', {
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

    const actionGroupFunction = new PythonFunction(this, 'PeakLoadManagerActionGroupFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: 'lambda/3-peak-load-manager',
      index: 'peak_load.py',
      handler: 'lambda_handler',
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_DAY,
      functionName: peakLoadManagerLambdaName,
      environment: {
        dynamodb_table: dynamodbTable,
        dynamodb_pk: dynamodbPk,
        dynamodb_sk: dynamodbSk,
      }
    });

    table.grantReadWriteData(actionGroupFunction);

    const actionGroup = new bedrock.AgentActionGroup({
      name: 'peak_load_actions',
      description: 'Function to get usage, peaks, redistribution for a user',
      executor: bedrock.ActionGroupExecutor.fromlambdaFunction(actionGroupFunction),
      functionSchema: {
        functions: [
          {
            name: 'detect_peak',
            description: 'detect consumption peak during current month',
            parameters: {
              customer_id: {
                description: 'The ID of the customer',
                required: true,
                type: 'string',
              },
            },
          },
          {
            name: 'detect_non_essential_processes',
            description: 'detect non-essential processes that are causing the peaks',
            parameters: {
              customer_id: {
                description: 'The ID of the customer',
                required: true,
                type: 'string',
              },
            },
          },
          {
            name: 'redistribute_allocation',
            description: 'reduce/increase allocated quota for a specific item during current month',
            parameters: {
              customer_id: {
                description: 'The ID of the customer',
                required: true,
                type: 'string',
              },
              item_id: {
                description: 'Item that will be updated',
                required: true,
                type: 'string',
              },
              quota: {
                description: 'new quota',
                required: true,
                type: 'string',
              },
            },
          },
        ]
      },
    });

    agent.addActionGroup(actionGroup);


    const codeInterpreterActionGroup = new bedrock.AgentActionGroup({
      name: 'PeakLoadCodeInterpreterAction',
      parentActionGroupSignature: bedrock.ParentActionGroupSignature.USER_INPUT,
    })

    agent.addActionGroup(codeInterpreterActionGroup);

    new CfnOutput(this, 'OutputAgentId', {
      value: this.agent.agentId,
      exportName: 'PeakLoadAgentId',
    });

    new CfnOutput(this, 'OutputAgentAliasId', {
      value: this.agentAlias.aliasId,
      exportName: 'PeakLoadAgentAliasId',
    });
  }

};