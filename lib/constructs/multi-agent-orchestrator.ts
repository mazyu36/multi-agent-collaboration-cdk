import { Construct } from 'constructs';
import {
  Stack,
  Duration,
  RemovalPolicy,
  aws_dynamodb as dynamodb,
  aws_logs as logs,
  aws_lambda as lambda
} from 'aws-cdk-lib';
import { PythonFunction, PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { EnergyForecast } from './1-energy-forecast';
import { PeakLoadManager } from './3-peak-load-manager';
import { SolarPanel } from './2-solar-panel';

export interface MultiAgentOrchestratorProps {

  energyForecast: EnergyForecast;
  solarPanel: SolarPanel;
  peakLoadManager: PeakLoadManager;
}

export class MultiAgentOrchestrator extends Construct {
  constructor(scope: Construct, id: string, props: MultiAgentOrchestratorProps) {
    super(scope, id);

    const { energyForecast, solarPanel, peakLoadManager } = props;

    const table = new dynamodb.Table(this, 'table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'TTL',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const layer = new PythonLayerVersion(this, 'Layer', {
      entry: 'lambda/layer',
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12]
    })

    const multiAgentOrchestratorFunction = new PythonFunction(this, 'MultiAgentOrchestrator', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: 'lambda/multi-agent-orchestrator',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        TABLE_NAME: table.tableName,
        ENERGY_FORECAST_AGENT_ID: energyForecast.agent.agentId,
        ENERGY_FORECAST_AGENT_ALIAS_ID: energyForecast.agentAlias.aliasId,
        SOLAR_PANEL_AGENT_ID: solarPanel.agent.agentId,
        SOLAR_PANEL_AGENT_ALIAS_ID: solarPanel.agentAlias.aliasId,
        PEAK_LOAD_MANAGER_AGENT_ID: peakLoadManager.agent.agentId,
        PEAK_LOAD_MANAGER_AGENT_ALIAS_ID: peakLoadManager.agentAlias.aliasId,
      },
      layers: [layer],
    });

    table.grantReadWriteData(multiAgentOrchestratorFunction);
  }
}