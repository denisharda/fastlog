import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Linking, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/revenuecat';
import { useUserStore } from '../stores/userStore';
import { trackProPurchased, trackPaywallViewed, trackCancellationLinkTapped, trackPaywallDismissed } from '../lib/posthog';
import { CARD_SHADOW } from '../constants/styles';

// AI features hidden — re-enable when AI coach returns:
// { icon: '🤖', title: 'AI Check-ins', description: 'Personalized messages at every fasting phase' },
// { icon: '📊', title: 'Weekly Insights', description: 'AI-generated weekly summary of your progress' },
// { icon: '🧠', title: 'Custom Coach', description: 'Choose your AI coach personality' },

type ComparisonRow = { label: string; free: boolean; pro: boolean };

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Fasting Timer',      free: true,  pro: true  },
  { label: 'Water Tracking',     free: true,  pro: true  },
  { label: 'Full History',       free: false, pro: true  },
  { label: 'Phase Science',      free: true,  pro: true  },
  { label: 'Custom Protocols',   free: false, pro: true  },
  { label: 'Smart Notifications',free: false, pro: true  },
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
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>

        {/* Close button */}
        <Pressable
          className="self-end mb-2"
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => { trackPaywallDismissed('paywall_screen'); router.back(); }}
        >
          <Text className="text-text-muted text-2xl">✕</Text>
        </Pressable>

        {/* Hero section */}
        <View className="items-center mb-8">
          <Text className="text-text-primary text-4xl font-bold text-center mb-2">
            FastAI Pro
          </Text>
          <Text className="text-text-muted text-center text-base">
            Unlock your full fasting potential
          </Text>
        </View>

        {/* Feature comparison card */}
        <View
          className="bg-white rounded-2xl mb-8 overflow-hidden"
          style={CARD_SHADOW}
        >
          {/* Table header */}
          <View className="flex-row items-center px-4 py-3 bg-surface border-b border-border">
            <Text className="flex-1 text-text-muted text-xs font-semibold uppercase tracking-wide">Feature</Text>
            <Text className="w-14 text-center text-text-muted text-xs font-semibold uppercase tracking-wide">Free</Text>
            <Text className="w-14 text-center text-primary text-xs font-semibold uppercase tracking-wide">Pro</Text>
          </View>

          {COMPARISON_ROWS.map((row, index) => (
            <View
              key={row.label}
              className={`flex-row items-center px-4 py-3 ${index % 2 === 1 ? 'bg-background/60' : 'bg-white'}`}
            >
              <Text className="flex-1 text-text-primary text-sm">{row.label}</Text>
              <View className="w-14 items-center">
                {row.free ? (
                  <Text className="text-primary text-base font-bold">✓</Text>
                ) : (
                  <Text className="text-text-muted text-base">✗</Text>
                )}
              </View>
              <View className="w-14 items-center">
                {row.pro ? (
                  <Text className="text-primary text-base font-bold">✓</Text>
                ) : (
                  <Text className="text-text-muted text-base">✗</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        {isLoading ? (
          <ActivityIndicator color="#2D6A4F" className="my-6" />
        ) : packages.length > 0 ? (
          <View className="gap-3 mb-6">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const isAnnual = pkg.identifier.toLowerCase().includes('annual');
              const breakdown = computePriceBreakdown(pkg);
              return (
                <Pressable
                  key={pkg.identifier}
                  className={`rounded-2xl border-2 overflow-hidden ${
                    isSelected ? 'border-primary' : 'border-text-muted/20'
                  }`}
                  style={[CARD_SHADOW, { minHeight: 44 }]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  {/* "Most Popular" badge — annual only */}
                  {isAnnual && (
                    <View className="bg-primary px-4 py-1 items-center">
                      <Text className="text-white text-xs font-bold tracking-wide uppercase">
                        Most Popular
                      </Text>
                    </View>
                  )}

                  <View
                    className={`p-4 ${isSelected ? 'bg-primary/10' : 'bg-white'}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text className="text-text-primary font-semibold text-base">
                            {isAnnual ? 'Annual' : 'Monthly'}
                          </Text>
                          {isAnnual && trialEligible && (
                            <View className="bg-accent px-2 py-0.5 rounded-full">
                              <Text className="text-white text-xs font-bold">7-day free trial</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-text-muted text-sm mt-0.5">
                          {pkg.product.priceString}
                          {isAnnual ? '/year' : '/month'}
                        </Text>
                        <Text className="text-accent text-xs font-medium mt-0.5">{breakdown}</Text>
                      </View>

                      {isAnnual && (
                        <View className="bg-primary/15 px-3 py-1.5 rounded-xl">
                          <Text className="text-primary text-xs font-bold">Save 42%</Text>
                        </View>
                      )}
                    </View>
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

        {/* Animated CTA */}
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <Pressable
            className="bg-primary py-4 rounded-2xl items-center"
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

        {/* Cancel anytime + Restore purchases */}
        <View className="flex-row items-center justify-center gap-1 mt-3 mb-1">
          <Pressable
            style={{ minHeight: 44, justifyContent: 'center' }}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color="#9CA3AF" size="small" />
            ) : (
              <Text className="text-text-muted text-sm underline">Restore purchases</Text>
            )}
          </Pressable>
          <Text className="text-text-muted text-sm mx-1">·</Text>
          <Pressable
            style={{ minHeight: 44, justifyContent: 'center' }}
            onPress={handleManageSubscription}
          >
            <Text className="text-text-muted text-sm underline">Cancel anytime</Text>
          </Pressable>
        </View>

        {/* Fine print */}
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
