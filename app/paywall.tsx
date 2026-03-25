import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Linking, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/revenuecat';
import { useUserStore } from '../stores/userStore';
import { trackProPurchased, trackPaywallViewed, trackCancellationLinkTapped } from '../lib/posthog';

// AI features hidden — re-enable when AI coach returns:
// { icon: '🤖', title: 'AI Check-ins', description: 'Personalized messages at every fasting phase' },
// { icon: '📊', title: 'Weekly Insights', description: 'AI-generated weekly summary of your progress' },
// { icon: '🧠', title: 'Custom Coach', description: 'Choose your AI coach personality' },
const PRO_FEATURES = [
  { icon: '📅', title: 'Fasting History', description: 'Track all your fasts and view trends' },
  { icon: '🔥', title: 'Streak Tracking', description: 'Build consistency and track your streak' },
  { icon: '💧', title: 'Water Tracking', description: 'Stay hydrated with smart reminders' },
  { icon: '🔔', title: 'Smart Notifications', description: 'Phase alerts and motivational reminders' },
];

function computePriceBreakdown(pkg: PurchasesPackage): string {
  const isAnnual = pkg.identifier.toLowerCase().includes('annual');
  const price = pkg.product.price;
  if (isAnnual) {
    const weekly = (price / 52).toFixed(2);
    return `Just $${weekly}/week`;
  }
  const daily = (price / 30).toFixed(2);
  return `$${daily}/day`;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { setIsPro } = useUserStore();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialEligible, setTrialEligible] = useState(false);

  // Subtle CTA animation
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    trackPaywallViewed('paywall_screen');

    async function loadOfferings() {
      const pkgs = await getOfferings();
      setPackages(pkgs);
      const annual = pkgs.find((p) => p.identifier.includes('annual'));
      setSelectedPackage(annual ?? pkgs[0] ?? null);

      // Check trial eligibility
      if (annual?.product?.introPrice) {
        try {
          const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility([
            annual.product.identifier,
          ]);
          const status = eligibility[annual.product.identifier];
          if (status?.status === 0 /* ELIGIBLE */) {
            setTrialEligible(true);
          }
        } catch {
          // If check fails, don't show trial badge
        }
      }

      setIsLoading(false);
    }
    loadOfferings();

    // Subtle pulse on CTA
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(ctaScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
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

  function handleManageSubscription() {
    trackCancellationLinkTapped();
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  }

  const ctaLabel = trialEligible
    ? 'Start Free Trial'
    : selectedPackage
    ? 'Start my plan'
    : 'Subscribe';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Close button */}
        <Pressable className="self-end mb-4" style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.back()}>
          <Text className="text-text-muted text-2xl">✕</Text>
        </Pressable>

        {/* Hero */}
        <View className="items-center mb-8">
          <Text className="text-5xl mb-4">⚡</Text>
          <Text className="text-text-primary text-3xl font-bold text-center mb-2">
            Unlock Pro
          </Text>
          <Text className="text-text-muted text-center text-base">
            Track your fasting history, build streaks, and stay hydrated with smart reminders.
          </Text>
        </View>

        {/* Feature list */}
        <View className="gap-4 mb-8">
          {PRO_FEATURES.map((feature) => (
            <View key={feature.title} className="flex-row items-center bg-white rounded-2xl p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
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
          <View className="gap-3 mb-4">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const isAnnual = pkg.identifier.toLowerCase().includes('annual');
              const breakdown = computePriceBreakdown(pkg);
              return (
                <Pressable
                  key={pkg.identifier}
                  className={`p-4 rounded-2xl border-2 ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-text-muted/20 bg-white'
                  }`}
                  style={{ minHeight: 44 }}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-text-primary font-semibold">
                          {isAnnual ? 'Annual' : 'Monthly'}
                        </Text>
                        {isAnnual && trialEligible && (
                          <View className="bg-accent px-2 py-0.5 rounded-full">
                            <Text className="text-white text-xs font-bold">7-day free trial</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-text-muted text-sm">
                        {pkg.product.priceString}
                        {isAnnual ? '/year' : '/month'}
                      </Text>
                      {/* Price breakdown */}
                      <Text className="text-accent text-xs mt-0.5">{breakdown}</Text>
                    </View>
                    {isAnnual && (
                      <View className="bg-primary px-2 py-1 rounded-lg">
                        <Text className="text-white text-xs font-bold">Save 42%</Text>
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

        {/* Trust indicator */}
        <View className="flex-row items-center justify-center mb-4 gap-1.5">
          <Text className="text-text-muted text-sm">🛡️</Text>
          <Text className="text-text-muted text-sm">Cancel anytime, no questions asked</Text>
        </View>

        {error ? (
          <Text className="text-red-400 text-center mb-4 text-sm">{error}</Text>
        ) : null}

        {/* Animated CTA */}
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <Pressable
            className="bg-primary py-4 rounded-2xl items-center mb-3"
            style={{ minHeight: 50 }}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedPackage}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-bold text-lg">
                {ctaLabel}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Restore + Manage */}
        <Pressable
          className="py-3 items-center"
          style={{ minHeight: 44 }}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator color="#9CA3AF" />
          ) : (
            <Text className="text-text-muted text-sm">Restore Purchases</Text>
          )}
        </Pressable>

        {/* Cancellation / manage link */}
        <Pressable
          className="py-3 items-center"
          style={{ minHeight: 44 }}
          onPress={handleManageSubscription}
        >
          <Text className="text-text-muted text-sm underline">
            Manage or cancel subscription
          </Text>
        </Pressable>

        {/* Legal */}
        <View className="mt-4 gap-1">
          <Text className="text-text-muted text-xs text-center">
            Subscription renews automatically. Cancel anytime.
          </Text>
          <View className="flex-row justify-center gap-4 mt-1">
            <Pressable onPress={() => Linking.openURL('https://fastai.app/terms')}>
              <Text className="text-text-muted text-xs underline">Terms of Service</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL('https://fastai.app/privacy')}>
              <Text className="text-text-muted text-xs underline">Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
