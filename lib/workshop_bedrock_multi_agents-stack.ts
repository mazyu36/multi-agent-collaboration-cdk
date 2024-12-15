import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnergyForecast } from './constructs/1-energy-forecast';
import { SolarPanel } from './constructs/2-solar-panel';

export class WorkshopBedrockMultiAgentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const energyForecast = new EnergyForecast(this, 'EnergyForecast', {})
    const solarPanel = new SolarPanel(this, 'SolarPanel', {})
  }
}
