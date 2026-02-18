/**
 * OpenTelemetry Instrumentation for Node.js API
 * Add this to backend/src/instrumentation.ts
 * 
 * Install dependencies first:
 * npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
 *   @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/exporter-metrics-otlp-grpc \
 *   @opentelemetry/sdk-metrics @opentelemetry/resources @opentelemetry/semantic-conventions \
 *   @opentelemetry/core @opentelemetry/propagator-b3
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from '@opentelemetry/core';
import { B3Propagator, B3InjectEncoding } from '@opentelemetry/propagator-b3';
import type { Span } from '@opentelemetry/api';
import type { IncomingMessage } from 'http';

const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL || 'http://otel-collector.observability:4317';

// Resource attributes
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: 'ml-scheduler-api',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  'service.namespace': 'ml-scheduler',
});

// Trace exporter
const traceExporter = new OTLPTraceExporter({
  url: OTEL_COLLECTOR_URL,
});

// Metric exporter
const metricExporter = new OTLPMetricExporter({
  url: OTEL_COLLECTOR_URL,
});

// Metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 10000,
});

// Initialize SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: metricReader as any,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable some noisy instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      // Configure HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/health/ready', '/health/live', '/metrics'],
        requestHook: (span, request) => {
          if ('headers' in request) {
            const requestId = (request as IncomingMessage).headers['x-request-id'];
            if (requestId) {
              span.setAttribute('http.request_id', Array.isArray(requestId) ? requestId[0] : requestId);
            }
          }
        },
      },
      // Configure Express instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      // Configure pg (PostgreSQL) instrumentation
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      // Configure Redis instrumentation
      '@opentelemetry/instrumentation-redis-4': {
        enabled: true,
      },
    }),
  ],
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
    ],
  }),
});

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error: Error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

// Start SDK
sdk.start();

console.log('OpenTelemetry instrumentation initialized');

export { sdk };
