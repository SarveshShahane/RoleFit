from typing import Dict

import boto3
from core.config import settings

class DynamoDB:
    
    def __init__(self):
        self.RESOURCE_NAME = settings.RESOURCE_NAME
        self.REGION_NAME = settings.REGION_NAME
        self.TABLE_NAME = settings.TABLE_NAME
        
    @property
    def table(self):
         db = boto3.resource(self.RESOURCE_NAME, region_name=self.REGION_NAME)
         table = db.Table(self.TABLE_NAME)
         return table

    def put_obj(self,item: Dict):
        self.table.put_item(Item=item)


db = DynamoDB()
