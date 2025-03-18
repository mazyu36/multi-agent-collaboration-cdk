import { Construct } from 'constructs';
import {
  Stack,
  Duration,
  RemovalPolicy,
  aws_dynamodb as dynamodb,
  aws_logs as logs,
  aws_lambda as lambda,
  CfnOutput
} from 'aws-cdk-lib';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { EnergyForecast } from './1-energy-forecast';
import { PeakLoadManager } from './3-peak-load-manager';
import { SolarPanel } from './2-solar-panel';

export interface EnergyAgentCollaboratorProps {
  energyForecast: EnergyForecast;
  solarPanel: SolarPanel;
  peakLoadManager: PeakLoadManager;
}

export class EnergyAgentCollaborator extends Construct {
  public readonly agent: bedrock.Agent;
  public readonly agentAlias: bedrock.AgentAlias;
  constructor(scope: Construct, id: string, props: EnergyAgentCollaboratorProps) {
    super(scope, id);

    // Constant
    const energyAgentName = 'enerygy-agent';


    // Agents
    const description = `You are a energy helper bot.
You can help customers with operations related with their energy, like consumption, forecast, peak usage, etc.`;

    const instruction = `You are a energy helper bot.
You can retrieve energy consumption and forecast for a specific users and help them to be compliant with energy rules.
You can also retrieve solar panel information and solar panel ticket for a specific users and help them to be compliant with energy rules.
You can also get current information about peaks and can redistribute load.
Resist the temptation to ask the user for input. Only do so after you have exhausted available actions.
Never ask the user for information that you already can retrieve yourself through available actions.`;

    const agent = new bedrock.Agent(this, 'SuperVisorAgent', {
      foundationModel: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
      instruction,
      description,
      idleSessionTTL: Duration.seconds(1800),
      name: energyAgentName,
      shouldPrepareAgent: true,
      agentCollaboration: bedrock.AgentCollaboratorType.SUPERVISOR_ROUTER,
      agentCollaborators: [
        new bedrock.AgentCollaborator({
          agentAlias: props.energyForecast.agentAlias,
          collaborationInstruction: 'Delegate energy consumption analysis and forecasting tasks to the Forecasting Agent, ensuring adherence to its specific protocols and capabilities.',
          collaboratorName: props.energyForecast.agent.name
        }),
        new bedrock.AgentCollaborator({
          agentAlias: props.solarPanel.agentAlias,
          collaborationInstruction: 'Assign solar panel-related inquiries and issues to the Solar Panel Agent, respecting its scope and support ticket protocol.',
          collaboratorName: props.solarPanel.agent.name
        }),
        new bedrock.AgentCollaborator({
          agentAlias: props.peakLoadManager.agentAlias,
          collaborationInstruction: 'Direct peak load management and energy optimization tasks to the Peak Load Manager Agent, leveraging its analytical capabilities.',
          collaboratorName: props.peakLoadManager.agent.name
        }),
      ]
    });
    this.agent = agent;

  }

};