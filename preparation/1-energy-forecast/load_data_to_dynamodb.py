import json
import boto3
import os

table_name='forecast-table'

script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, "1_user_sample_data.json")

with open(file_path) as f:
    table_items = [json.loads(line) for line in f]

try:
    dynamodb_resource = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb_resource.Table(table_name)
    for item in table_items:
        table.put_item(Item=item)
    print(f'Loaded data into table: {table_name}')
except Exception:
    print(f'Error on loading process for table: {table_name}.')
