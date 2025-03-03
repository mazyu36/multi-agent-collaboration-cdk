# Energy Efficiency Management System - Multi-Agent Workshop on CDK
This repository implements the [Energy Efficiency Management System - Multi-Agent Workshop](https://github.com/aws-samples/bedrock-multi-agents-collaboration-workshop) using AWS CDK.

![](./img/0-energy-manager-agent.png)

Supervisor agent is created by using [multi agent orchestrator](https://github.com/awslabs/multi-agent-orchestrator).

```markdown
### Sub-Agents

#### 1. Forecasting Agent
- Provides current energy consumption data
- Provides consumption forecasts
- Provides user consumption statistics
- Contains code interpretation capabilities to analyze forecasting data

#### 2. Solar Panel Agent
- Provides installation guidelines and requirements
- Offers maintenance instructions and schedules
- Enables support ticket creation
- Tracks existing support tickets

#### 3. Peak Load Manager Agent
- Identifies non-essential processes
- Analyzes peak vs. off-peak usage
- Optimizes grid allocation
```

## Preperation
After running `cdk deploy`, execute the script using the following command to import data to DynamoDB tables.
Python and boto3 are required.

```sh
% python preparation/load_data_to_dynamodb.py
```

## Multi Agents Settings

### Description

```
You are a energy helper bot. You can help customers with operations related with their energy, like consumption,forecast, peak usage, etc.
```

### Instruction

```
You are a energy helper bot.
You can retrieve energy consumption and forecast for a specific users and help them to be compliant with energy rules.
You can also retrieve solar panel information and solar panel ticket for a specific users and help them to be compliant with energy rules.
You can also get current information about peaks and can redistribute load.
Resist the temptation to ask the user for input. Only do so after you have exhausted available actions.
Never ask the user for information that you already can retrieve yourself through available actions.
```

### Sub Agent instructions

```
# forecast
Delegate energy consumption analysis and forecasting tasks to the Forecasting Agent, ensuring adherence to its specific protocols and capabilities.

# solar-panel
Assign solar panel-related inquiries and issues to the Solar Panel Agent, respecting its scope and support ticket protocol.

# peak-load-manager
Direct peak load management and energy optimization tasks to the Peak Load Manager Agent, leveraging its analytical capabilities.
```

## How to use multi-agent

```sh
curl --location 'https://YOUR_LAMBDA_FUNCTION_URL' \
--header 'Content-Type: application/json' \
--data '{
    "query": "Can you give me my forecasted energy consumption month by month? My id is 1",
    "userId": "test-user",
    "sessionId": "test"
}'

# result
{"metadata": {"agent_id": "energy-forecast-agent", "agent_name": "Energy Forecast Agent", "user_input": "Can you give me my forecasted energy consumption month by month? My id is 1", "session_id": "test"}, "output": "Here is your forecasted energy consumption for the next 3 months:\n- November 2024: 170.0 kWh\n- December 2024: 175.0 kWh\n- January 2025: 182.0 kWh\n", "streaming": false}
```



## Prompt
### 1. Energy Forecast
* Testing get forecast

```
Prompt: can you give me my forecasted energy consumption? How does it compare with my past energy usage? My customer id is 1

Agent: Your forecasted energy consumption for November, December, and January is 170.0, 175.0, and 182.0 respectively. This is generally higher than your past energy usage, which was 120.0, 130.0, 140.0, 150.0, and 200.0 for June, July, August, September, and October respectively. This indicates an expected increase in your energy usage.
```

* Testing get historical consumption

```
Prompt: can you give me my past energy consumption? What is my average spending on summer months? My customer id is 1

Agent: Your past energy consumption for June, July, August, September, and October is 120.0, 130.0, 140.0, 150.0, and 200.0 respectively. Your average spending on summer months (June, July, and August) is 130.0.
```

* Testing knowledge base access

```
Prompt: What's algorithm used for forecast?

Agent: he algorithm used for forecasting is the Random Forest model. This model predicts future power readings based on the patterns it learned from historical data. It considers the day of the week, month, and year as features to make predictions. The Root Mean Squared Error (RMSE) provides an indication of the model's accuracy, with lower RMSE values indicating better performance.
```

* Testing forecast update

```
Prompt: Can you update my forecast for month 12/2024? I will be travelling and my estimate will be 50. My id is 1

Agent: Your forecast for December 2024 has been successfully updated to 50.
```

* Confirming that forecast was updated

```
Prompt: Can you give me my forecasted energy consumption month by month? My id is 1

Agent: Your forecasted energy consumption for November 2024 is 170.0, for December 2024 is 50, and for January 2025 is 182.0.
```

* Testing forecasting statistics

```
Prompt: can you give me my current consumption? My id is 1

Agent: Your current consumption is 50.
```

### 2. Solar Energy

* Testing maintainance question

```
Prompt: how can I check if my Sunpower double-X solar panel eletrical consumption is compliant with energy rules?

Agent: To ensure your Sunpower Double-X solar panel's electrical consumption is compliant with energy rules, follow these steps: 1. **Monitor System Performance**: Regularly review the solar panel's energy output and compare it to the expected performance. Significant deviations may indicate a need for further investigation or maintenance. 2. **Comply with Energy Regulations**: Stay informed about any changes in local energy regulations and ensure that your Sunpower Double-X solar panel installation continues to meet all applicable requirements. Consult with local authorities or a qualified solar installer if you have any questions or concerns. For detailed maintenance instructions, refer to the provided sources.
```

* Testing installation question

```
Prompt: how can I install my Sunpower Y solar panel at home?

Agent: To install your Sunpower Y solar panel at home, follow these steps: 1. **Evaluate the Installation Site**: Confirm that the site meets the solar exposure requirements. 2. **Obtain Permits and Approvals**: Verify that you have obtained the necessary permits and approvals from local authorities. 3. **Prepare the Mounting Surface**: Ensure the surface can support the weight of the Sunpower Y solar panel. 4. **Assemble the Mounting Hardware**: Securely attach the mounting hardware to the prepared surface. 5. **Position the Solar Panel**: Carefully lift and position the Sunpower Y solar panel onto the mounting system. 6. **Connect to the Electrical System**: Adhere to all safety guidelines when connecting the solar panel to the electrical system. 7. **Perform a System Test**: Validate the solar panel's performance with a comprehensive system test. For detailed instructions, refer to the provided sources.
```

* Testing personalized support

```
Prompt: Can I get support to install my Sunpower X solar panel? My customer id is 1

Agent: Your support ticket has been successfully created. Please use the following case ID for reference: 56c49aa6-bae5-11ef-a452-99fb1ac3918c. A specialist will contact you shortly to assist with the installation of your Sunpower X solar panel.
```

* Testing getting support ticket details

```
Prompt: Can I get details on my ticket? My customer id is 1 get my ticket id from our previous conversation.


Agent: Your ticket details are as follows: - Customer ID: 1 - Ticket ID: 56c49aa6-bae5-11ef-a452-99fb1ac3918c - Description: Requesting support to install Sunpower X solar panel - Status: created A specialist will contact you shortly to assist with the installation of your Sunpower X solar panel.
```

* Testing get open support tickets

```
Prompt: Can I get support to review my Sunpower double-X solar panel consumption? My customer id is 1

Agent: Your support ticket has been successfully created. Please use the following case ID for reference: 7996765d-bae5-11ef-855f-99fb1ac3918c. A specialist will contact you shortly to assist with reviewing your Sunpower double-X solar panel consumption.
```

### 3. Peak Load Manager

* Testing non-essential process detection

```
Prompt: What's causing my peak load? My id is 2

Answer: The peak load is caused by the following non-essential processes: gardening electrical system, iron, and dry-machine. These processes are using more energy than their allocated quota, leading to the peak load. To mitigate this, consider adjusting the schedules of these processes to non-peak hours or reducing their energy consumption.
```

* Testing load optimization

```
Prompt: Is it possible to optimize my consumption? My id is 1

Answer: The peak load is caused by the car charger socket, which is an essential process. Therefore, optimization is not possible without affecting critical operations. However, you can consider reviewing other non-essential processes to see if their schedules can be adjusted to non-peak hours.
```

* Testing load relocation

```
Prompt: Is it possible to change quota allocation? My id is 2, my item is 5 and new quota is 100

Answer: The quota allocation for item 5 has been successfully updated to 100.
```

### 4.Multi Agents

* Forecasting Agent

```

Prompt: Can you give me my forecasted energy consumption? How does it compare to my current usage? My id is 1

Agent: The forecasted energy consumption for customer ID 1 is 170.0 kWh for November 2024, 50 kWh for December 2024, and 182.0 kWh for January 2025. The current usage for customer ID 1 is 50 kWh for December 2024. The forecasted energy consumption for December 2024 matches the current usage, while the forecasted energy consumption for November 2024 and January 2025 is higher than the current usage.


Prompt: Can you give me my past energy consumption? What is my average spending on summer months? My customer id is 1

Agent: The past energy consumption for customer ID 1 is 120.0 kWh for June 2024, 130.0 kWh for July 2024, 140.0 kWh for August 2024, 150.0 kWh for September 2024, and 200.0 kWh for October 2024. The average spending on summer months (June, July, and August) is (120.0 + 130.0 + 140.0) / 3 = 130.0 kWh.


Prompt: Can you update my forecast for month 12/2024? I will be travelling and my estimate will be 70. My id is 1

Agent: The forecasted energy consumption for customer ID 1 has been updated to 70 kWh for December 2024.


Prompt: Can you give me my forecasted energy consumption month by month? My id is 1

Agent: The forecasted energy consumption for customer ID 1 is 170.0 kWh for November 2024, 70 kWh for December 2024, and 182.0 kWh for January 2025.

```

* Solar Panel Agent

```
Prompt: how can I check if my Sunpower double-X solar panel eletrical consumption is compliant with energy rules?

Agent: The Sunpower Double-X solar panel is designed to comply with energy regulations. To ensure compliance, it is important to follow the installation and maintenance guidelines provided by Sunpower. These guidelines include obtaining the necessary permits and approvals from local authorities, preparing the mounting surface, securely installing the mounting brackets, and connecting the solar panel to the electrical system following all safety protocols. Additionally, regular maintenance of the Sunpower Double-X solar panel is crucial to ensure continued compliance with energy regulations. This includes cleaning the panel surface, inspecting the electrical connections, examining the mounting system, monitoring system performance, and staying informed about any changes in local energy regulations. If you have any questions or concerns about compliance with energy regulations, it is recommended to consult with local authorities or a qualified solar installer.

Prompt: Can I get all tickets that I have? My customer id is 1

Agent: Here are the tickets for customer ID 1: - Ticket ID: 1b368ab6-bae4-11ef-b142-8dac9ce64571, Description: Requesting support to review Sunpower double-X solar panel consumption, Status: created - Ticket ID: 56c49aa6-bae5-11ef-a452-99fb1ac3918c, Description: Requesting support to install Sunpower X solar panel, Status: created - Ticket ID: 7996765d-bae5-11ef-855f-99fb1ac3918c, Description: Requesting support to review Sunpower double-X solar panel consumption, Status: created - Ticket ID: 9a8deddb-bae3-11ef-a5c5-8dac9ce64571, Description: Requesting support to install Sunpower X solar panel, Status: created

```

* Peak Load Manager Agent

```
Prompt: What's causing my peak load? My id is 2.

Agent: Here is the peak load information for your account: - Peak: True - Quota: 100 - Item ID: 5 - Essential: False - Customer ID: 2 - Used: 250 - Item Description: gardening electrical system It appears that your peak load is being caused by your gardening electrical system, which has exceeded its quota of 100 by using 250 units.


Prompt: Is it possible to optimize my consumption? My id is 1

Agent: The energy consumption for customer ID 1 has been optimized. The non-essential processes have been identified and their quotas have been adjusted. The new quotas are as follows: - Item ID 2 (iron): 20 - Item ID 3 (dry-machine): 30
```