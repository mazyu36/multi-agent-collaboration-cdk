#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WorkshopBedrockMultiAgentsStack } from '../lib/workshop_bedrock_multi_agents-stack';

const app = new cdk.App();
new WorkshopBedrockMultiAgentsStack(app, 'WorkshopBedrockMultiAgentsStack', {
  env: {
    region: 'us-east-1'
  },
});