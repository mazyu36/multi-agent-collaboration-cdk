import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnergyForecast } from './constructs/1-energy-forecast';

export class WorkshopBedrockMultiAgentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const energyForecast = new EnergyForecast(this, 'EnergyForecast', {})
  }
}
