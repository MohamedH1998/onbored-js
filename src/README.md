# OnPulse SDK Documentation

## Overview
OnPulse is a powerful session replay and analysis SDK that enables you to capture user sessions, analyze user behavior, and gain actionable insights to improve your application's user experience.

## Installation

```bash
npm install on-pulse
# or
yarn add on-pulse
# or
pnpm add on-pulse
```

## Quick Start

### Basic Implementation
```typescript
import { SmartRecorderProvider } from 'on-pulse';

function App() {
  return (
    <SmartRecorderProvider
      apiKey="your-api-key"
      options={{
        apiHost: "https://your-api-host.com",
        // Additional options...
      }}
    >
      {/* Your app components */}
    </SmartRecorderProvider>
  );
}
```

### Manual Initialization
```typescript
import { smartRecorder } from 'on-pulse';

smartRecorder.init('your-api-key', {
  apiHost: 'https://your-api-host.com',
  // Additional options...
});
```

## Core Features

### 1. Session Recording
The SDK automatically captures:
- User interactions (clicks, scrolls, form inputs)
- Page navigation
- Console logs
- Network requests
- Performance metrics

### 2. Performance Monitoring
Tracks key web vitals:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

### 3. Network Monitoring
Captures:
- API requests and responses
- Request/response headers
- Request duration
- Error tracking

## API Reference

### SmartRecorderProvider Props

| Prop | Type | Description |
|------|------|-------------|
| `apiKey` | string | Your OnPulse API key |
| `options` | SmartReplayOptions | Configuration options |
| `client` | SmartRecorder | Optional pre-initialized client |

### SmartReplayOptions

```typescript
interface SmartReplayOptions {
  apiHost: string;
  uploadUrl?: string;
  debug?: boolean;
  onError?: (error: Error) => void;
  // Additional options...
}
```

### Core Methods

#### `smartRecorder.init(projectKey: string, options: SmartReplayOptions)`
Initializes the recorder with your project key and configuration options.

#### `smartRecorder.stop()`
Stops the recording session.

#### `smartRecorder.getSessionId()`
Returns the current session ID.

#### `smartRecorder.clearEvents()`
Clears all recorded events.

## Plugins

### Console Plugin
Captures console logs, warnings, and errors.

### Performance Plugin
Monitors and reports web vitals and performance metrics.

### Network Plugin
Tracks network requests and responses.

## Session Management

The SDK automatically manages sessions with the following features:
- 30-minute session timeout
- Automatic session renewal
- Session persistence across page reloads
- Unique session identification

## Best Practices

1. **Initialization**
   - Initialize the SDK as early as possible in your application
   - Use the provider pattern for React applications
   - Keep your API key secure

2. **Performance**
   - The SDK is designed to have minimal impact on your application's performance
   - Events are batched and uploaded periodically
   - Network requests are optimized to reduce overhead

3. **Privacy**
   - Sensitive data can be masked using configuration options
   - Network requests can be filtered
   - Console logs can be sanitized

## Error Handling

The SDK includes built-in error handling:
- Automatic retry mechanism for failed uploads
- Error reporting through the `onError` callback
- Debug mode for development

## Development

For local development:
```bash
# Link the SDK locally
pnpm add ../on-pulse --save-dev

# Run in development mode
NEXT_PUBLIC_SMART_RECORDER_KEY=your-key
NEXT_PUBLIC_SMART_RECORDER_HOST=http://localhost:3000/api
```

## Browser Support

The SDK supports all modern browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Limitations

- Session recording is not supported in older browsers
- Some features may be limited in private browsing mode
- Network monitoring may be affected by CORS policies

## Troubleshooting

Common issues and solutions:

1. **Recording not starting**
   - Check if the API key is correct
   - Verify the API host is accessible
   - Ensure the SDK is properly initialized

2. **Performance issues**
   - Check if debug mode is enabled
   - Verify network connectivity
   - Monitor browser console for errors

3. **Data not uploading**
   - Check network connectivity
   - Verify API endpoint accessibility
   - Check for CORS issues

## Support

For additional support:
- Check the documentation
- Open an issue on GitHub
- Contact support

## License

MIT License