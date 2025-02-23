import uuid
import asyncio
from typing import Optional, List, Dict, Any
import json
import os
import sys
from multi_agent_orchestrator.orchestrator import (
    MultiAgentOrchestrator,
    OrchestratorConfig,
)
from multi_agent_orchestrator.agents import (
    AmazonBedrockAgent,
    AmazonBedrockAgentOptions,
    AgentResponse,
)
from multi_agent_orchestrator.classifiers import BedrockClassifier, BedrockClassifierOptions

from multi_agent_orchestrator.storage import DynamoDbChatStorage
from multi_agent_orchestrator.types import ConversationMessage

region = os.environ.get("AWS_REGION", "us-east-1")
table_name = os.getenv("TABLE_NAME")
energy_forecast_agent_id = os.getenv("ENERGY_FORECAST_AGENT_ID")
energy_forecast_agent_alias_id = os.getenv("ENERGY_FORECAST_AGENT_ALIAS_ID")
solar_panel_agent_id = os.getenv("SOLAR_PANEL_AGENT_ID")
solar_panel_agent_alias_id = os.getenv("SOLAR_PANEL_AGENT_ALIAS_ID")
peak_load_agent_id = os.getenv("PEAK_LOAD_AGENT_ID")
peak_load_agent_alias_id = os.getenv("PEAK_LOAD_AGENT_ALIAS_ID")

TTL_DURATION = 3600  # in seconds
dynamodb_storage = DynamoDbChatStorage(
    table_name, ttl_key="TTL", ttl_duration=TTL_DURATION, region=region,
)

custom_bedrock_classifier = BedrockClassifier(BedrockClassifierOptions(
    model_id='amazon.nova-pro-v1:0',
    region='us-east-1',
    inference_config={
        'maxTokens': 500,
        'temperature': 0.7,
        'topP': 0.9
    }
))

orchestrator = MultiAgentOrchestrator(
    options=OrchestratorConfig(
        LOG_AGENT_CHAT=True,
        LOG_CLASSIFIER_CHAT=True,
        LOG_CLASSIFIER_RAW_OUTPUT=True,
        LOG_CLASSIFIER_OUTPUT=True,
        LOG_EXECUTION_TIMES=True,
        MAX_RETRIES=3,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
        MAX_MESSAGE_PAIRS_PER_AGENT=10,
    ),
    storage=dynamodb_storage,
    classifier=custom_bedrock_classifier
)

energy_forecast_agent = AmazonBedrockAgent(
    AmazonBedrockAgentOptions(
        name="Energy Forecast Agent",
        description="Delegate energy consumption analysis and forecasting tasks to the Forecasting Agent, ensuring adherence to its specific protocols and capabilities.",
        agent_id=energy_forecast_agent_id,
        agent_alias_id=energy_forecast_agent_alias_id,
    )
)
orchestrator.add_agent(energy_forecast_agent)

solar_panel_agent = AmazonBedrockAgent(
    AmazonBedrockAgentOptions(
        name="Solar Panel Agent",
        description="Assign solar panel-related inquiries and issues to the Solar Panel Agent, respecting its scope and support ticket protocol.",
        agent_id=solar_panel_agent_id,
        agent_alias_id=solar_panel_agent_alias_id,
    )
)
orchestrator.add_agent(solar_panel_agent)

peak_load_agent = AmazonBedrockAgent(
    AmazonBedrockAgentOptions(
        name="Peak Load Manager Agent",
        description="Direct peak load management and energy optimization tasks to the Peak Load Manager Agent, leveraging its analytical capabilities.",
        agent_id=peak_load_agent_id,
        agent_alias_id=peak_load_agent_alias_id,
    )
)
orchestrator.add_agent(peak_load_agent)


def serialize_agent_response(response: Any) -> Dict[str, Any]:

    text_response = ''
    if isinstance(response, AgentResponse) and response.streaming is False:
        # Handle regular response
        if isinstance(response.output, str):
            text_response = response.output
        elif isinstance(response.output, ConversationMessage):
                text_response = response.output.content[0].get('text')

    """Convert AgentResponse into a JSON-serializable dictionary."""
    return {
        "metadata": {
            "agent_id": response.metadata.agent_id,
            "agent_name": response.metadata.agent_name,
            "user_input": response.metadata.user_input,
            "session_id": response.metadata.session_id,
        },
        "output": text_response,
        "streaming": response.streaming,
    }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        user_input = event.get('query')
        user_id = event.get('userId')
        session_id = event.get('sessionId')
        response = asyncio.run(orchestrator.route_request(user_input, user_id, session_id))

        # Serialize the AgentResponse to a JSON-compatible format
        serialized_response = serialize_agent_response(response)

        return {
            "statusCode": 200,
            "body": json.dumps(serialized_response)
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal Server Error"})
        }