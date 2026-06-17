import os
import logging
from flask import Flask, g, request
from flask_cors import CORS
from datetime import datetime

logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    
    # Configure CORS
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    CORS(app, resources={r"/api/*": {"origins": frontend_url}})
    
    # Setup rate limiter with Flask app
    from utils.limiter import limiter
    limiter.init_app(app)
    
    # Setup request logger middlewares
    @app.before_request
    def log_request():
        g.start_time = datetime.now()
        logger.info(f"Request: {request.method} {request.path}")

    @app.after_request
    def log_response(response):
        if hasattr(g, 'start_time'):
            duration = (datetime.now() - g.start_time).total_seconds() * 1000
            logger.info(f"Response: {request.method} {request.path} {response.status_code} {duration:.2f}ms")
        return response

    # Register blueprints
    from routes.predict import predict_bp
    from routes.train import train_bp
    from routes.admin import admin_bp
    from routes.health import health_bp
    from routes.simulation import simulation_bp
    
    # API endpoints prefixed with /api
    app.register_blueprint(predict_bp, url_prefix='/api')
    app.register_blueprint(train_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(simulation_bp)
    app.register_blueprint(health_bp)

    # OpenTelemetry trace provider configuration and instrumentation
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource as OTelResource
        
        otel_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT')
        if otel_endpoint:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            resource = OTelResource.create({"service.name": "ml-service", "service.version": "1.0.0"})
            provider = TracerProvider(resource=resource)
            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otel_endpoint)))
            trace.set_tracer_provider(provider)
            
            from opentelemetry.instrumentation.flask import FlaskInstrumentor
            FlaskInstrumentor().instrument_app(app)
            logger.info(f"OpenTelemetry Flask tracing enabled → {otel_endpoint}")
    except Exception as e:
        logger.info(f"OpenTelemetry setup skipped: {e}")

    return app
