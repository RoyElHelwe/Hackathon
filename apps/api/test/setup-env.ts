// Test environment: real Postgres test DB, deterministic AI, fake Classroom, no cron.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://tajriba:tajriba@localhost:5432/tajriba_test';
process.env.AI_PROVIDER = 'mock';
process.env.CLASSROOM_PROVIDER = 'fake';
process.env.DEV_LOGIN = 'true';
process.env.AI_CACHE = 'false';
process.env.CRON_ENABLED = 'false';
process.env.UPLOAD_DIR = '/tmp/tajriba-test-uploads';
process.env.JWT_SECRET = 'test-secret';
