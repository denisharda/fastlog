import React, { Component, ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-background items-center justify-center px-6">
          <Text className="text-text-primary text-xl font-bold mb-2 text-center">
            Something went wrong
          </Text>
          <Text className="text-text-muted text-center mb-6">
            An unexpected error occurred. Please try again.
          </Text>
          <Pressable
            className="bg-primary px-6 py-3 rounded-xl"
            onPress={() => this.setState({ hasError: false })}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
