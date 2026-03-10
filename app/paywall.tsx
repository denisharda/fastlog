import { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/revenuecat';
import { useUserStore } from '../stores/userStore';
import { trackProPurchased } from '../lib/posthog';

const PRO_FEATURES = [
  { icon: '🤖', title: 'AI Check-ins', description: 'Personalized messages at hours 4, 8, and 12' },
  { icon: '📅', title: 'Fasting History', description: 'Track all your fasts and view trends' },
  { icon: '🔥', title: 'Streaks', description: 'Stay motivated with consecutive fast tracking' },
  { icon: '📊', title: 'Weekly Insights', description: 'AI-generated weekly summary of your progress' },
  { icon: '🧠', title: 'Custom Coach', description: 'Choose your AI coach personality' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { setIsPro } = useUserStore();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOfferings() {
      const pkgs = await getOfferings();
      setPackages(pkgs);
      // Default to annual if available
      const annual = pkgs.find((p) => p.identifier.includes('annual'));
      setSelectedPackage(annual ?? pkgs[0] ?? null);
      setIsLoading(false);
    }
    loadOfferings();
  }, []);

  async function handlePurchase() {
    if (!selectedPackage) return;
    setIsPurchasing(true);
    setError(null);

    const { success, isPro } = await purchasePackage(selectedPackage);

    if (success && isPro) {
      setIsPro(true);
      trackProPurchased({
        product: selectedPackage.identifier,
        price: selectedPackage.product.price,
      });
      router.back();
    } else if (!success) {
      setError('Purchase failed. Please try again.');
    }

    setIsPurchasing(false);
  }

  async function handleRestore() {
    setIsRestoring(true);
    const isPro = await restorePurchases();
    if (isPro) {
      setIsPro(true);
      router.back();
    } else {
      setError('No active subscription found.');
    }
    setIsRestoring(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Close button */}
        <Pressable className="self-end mb-4" onPress={() => router.back()}>
          <Text className="text-text-muted text-2xl">✕</Text>
        </Pressable>

        {/* Hero */}
        <View className="items-center mb-8">
          <Text className="text-5xl mb-4">⚡</Text>
          <Text className="text-text-primary text-3xl font-bold text-center mb-2">
            FastAI Pro
          </Text>
          <Text className="text-text-muted text-center text-base">
            Supercharge your fasting with AI coaching and deep insights.
          </Text>
        </View>

        {/* Feature list */}
        <View className="gap-4 mb-8">
          {PRO_FEATURES.map((feature) => (
            <View key={feature.title} className="flex-row items-center">
              <Text className="text-2xl mr-4">{feature.icon}</Text>
              <View className="flex-1">
                <Text className="text-text-primary font-semibold">{feature.title}</Text>
                <Text className="text-text-muted text-sm">{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Package selector */}
        {isLoading ? (
          <ActivityIndicator color="#2D6A4F" className="my-4" />
        ) : packages.length > 0 ? (
          <View className="gap-3 mb-6">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const isAnnual = pkg.identifier.toLowerCase().includes('annual');
              return (
                <Pressable
                  key={pkg.identifier}
                  className={`p-4 rounded-2xl border-2 ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-surface bg-surface'
                  }`}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-text-primary font-semibold">
                        {isAnnual ? 'Annual' : 'Monthly'}
                      </Text>
                      <Text className="text-text-muted text-sm">
                        {pkg.product.priceString}
                        {isAnnual ? '/year' : '/month'}
                      </Text>
                    </View>
                    {isAnnual && (
                      <View className="bg-primary px-2 py-1 rounded-lg">
                        <Text className="text-text-primary text-xs font-bold">Save 42%</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text className="text-text-muted text-center mb-6">
            Pricing unavailable. Please check your connection.
          </Text>
        )}

        {error ? (
          <Text className="text-red-400 text-center mb-4 text-sm">{error}</Text>
        ) : null}

        {/* CTA */}
        <Pressable
          className="bg-primary py-4 rounded-2xl items-center mb-3"
          onPress={handlePurchase}
          disabled={isPurchasing || !selectedPackage}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#F5F5F5" />
          ) : (
            <Text className="text-text-primary font-bold text-lg">
              {selectedPackage ? `Start Pro — ${selectedPackage.product.priceString}` : 'Subscribe'}
            </Text>
          )}
        </Pressable>

        <Pressable
          className="py-3 items-center"
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator color="#9CA3AF" />
          ) : (
            <Text className="text-text-muted text-sm">Restore Purchases</Text>
          )}
        </Pressable>

        <Text className="text-text-muted text-xs text-center mt-4">
          Subscription renews automatically. Cancel anytime.{'\n'}
          By subscribing you agree to our Terms of Service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
