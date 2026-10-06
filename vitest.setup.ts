process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1d';
process.env.GATEWAY_SECRET = 'test-gateway-secret';

process.env.DATABASE_URL =
  'postgresql://test_user:test_password@127.0.0.1:5432/test_db';

process.env.KAFKA_BROKER = '127.0.0.1:9092';

process.env.AUTH_SERVICE_URL = 'http://127.0.0.1:5010';
process.env.TASK_SERVICE_URL = 'http://127.0.0.1:5011';
process.env.MEDIA_SERVICE_URL = 'http://127.0.0.1:5012';
process.env.WORKFLOW_SERVICE_URL = 'http://127.0.0.1:5013';

process.env.AWS_ENDPOINT_URL_S3 = 'http://127.0.0.1:9000';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.STORAGE_BUCKET = 'test-bucket';
