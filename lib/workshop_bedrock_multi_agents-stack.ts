import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnergyForecast } from './constructs/1-energy-forecast';
import { SolarPanel } from './constructs/2-solar-panel';
import { PeakLoadManager } from './constructs/3-peak-load-manager';
import { MultiAgentOrchestrator } from './constructs/multi-agent-orchestrator';

export class WorkshopBedrockMultiAgentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const energyForecast = new EnergyForecast(this, 'EnergyForecast', {})
    const solarPanel = new SolarPanel(this, 'SolarPanel', {})
    const peakLoadManager = new PeakLoadManager(this, 'PeakLoadManager', {})

    new MultiAgentOrchestrator(this,'MultiAgentOrchestrator', {
      energyForecast,
      solarPanel,
      peakLoadManager,
    })
  }
}
