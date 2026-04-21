import { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/revenuecat';
import { useUserStore } from '../stores/userStore';
import {
  trackProPurchased,
  trackPaywallViewed,
  trackPaywallDismissed,
} from '../lib/posthog';
import { useTheme } from '../hooks/useTheme';
import { Card, CircleIcon, PrimaryButton, AmbientGlow } from '../components/ui';
import { TABULAR, hexAlpha, elevatedShadow, Theme } from '../constants/theme';

interface CompareRow {
  label: string;
  free: boolean;
  pro: boolean;
}

const ROWS: CompareRow[] = [
  { label: 'Fasting Timer',    free: true,  pro: true },
  { label: 'Water Tracking',   free: true,  pro: true },
  { label: 'Full History',     free: false, pro: true },
  { label: 'Custom Protocols', free: false, pro: true },
  { label: 'Share & Export',   free: false, pro: true },
  { label: 'Scheduled Fasts',  free: false, pro: true },
];

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setIsPro = useUserStore(s => s.setIsPro);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialEligible, setTrialEligible] = useState(false);

  useEffect(() => {
    trackPaywallViewed('paywall_screen');
    (async () => {
      const pkgs = await getOfferings();
      setPackages(pkgs);
      const annual = pkgs.find(p => p.identifier.toLowerCase().includes('annual'));
      setSelected(annual ?? pkgs[0] ?? null);

      if (annual?.product?.introPrice) {
        try {
          const e = await Purchases.checkTrialOrIntroductoryPriceEligibility([annual.product.identifier]);
          if (e[annual.product.identifier]?.status === 0) setTrialEligible(true);
        } catch {
          // ignore — no trial badge
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function handlePurchase() {
    if (!selected) return;
    setIsPurchasing(true);
    setError(null);
    const { success, isPro } = await purchasePackage(selected);
    if (success && isPro) {
      setIsPro(true);
      trackProPurchased({ product: selected.identifier, price: selected.product.price });
      router.back();
    } else if (!success) {
      setError('Purchase failed. Please try again.');
    }
    setIsPurchasing(false);
  }

  async function handleRestore() {
    setIsRestoring(true);
    const pro = await restorePurchases();
    if (pro) {
      setIsPro(true);
      router.back();
    } else {
      setError('No active subscription found.');
    }
    setIsRestoring(false);
  }

  const monthly = packages.find(p => p.identifier.toLowerCase().includes('month'));
  const annual = packages.find(p => p.identifier.toLowerCase().includes('annual'));
  const ctaLabel = trialEligible ? 'Start 7-day Free Trial' : 'Start my plan';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AmbientGlow
        color={theme.primary}
        alpha={theme.isDark ? 0x55 : 0x44}
        width={520}
        height={360}
        top={-160}
      />

      {/* Close */}
      <View
        style={{
          paddingTop: 58,
          paddingHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        <CircleIcon
          theme={theme}
          size={32}
          onPress={() => {
            trackPaywallDismissed('paywall_screen');
            router.back();
          }}
        >
          <Svg width={11} height={11} viewBox="0 0 11 11">
            <Path d="M1 1l9 9M10 1l-9 9" stroke={theme.textMuted} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </CircleIcon>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingBottom: 22 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: hexAlpha(theme.primary, 0x22),
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.primary }} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: theme.primary,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Pro
            </Text>
          </View>
          <Text
            style={{
              fontSize: 36,
              fontWeight: '700',
              color: theme.text,
              letterSpacing: -1.2,
              marginTop: 10,
              textAlign: 'center',
              lineHeight: 38,
            }}
          >
            Go deeper with{'\n'}your fasting story
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: theme.textMuted,
              marginTop: 10,
              maxWidth: 300,
              textAlign: 'center',
              letterSpacing: -0.1,
              lineHeight: 21,
            }}
          >
            Full history, custom protocols, scheduled fasts — and support an independent team.
          </Text>
        </View>

        {/* Comparison table */}
        <Card theme={theme} padding={0} style={{ marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              paddingHorizontal: 16,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.hairline,
            }}
          >
            <View style={{ flex: 1.5 }} />
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: '700',
                color: theme.textFaint,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Free
            </Text>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: '700',
                color: theme.primary,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Pro
            </Text>
          </View>
          {ROWS.map((r, i) => (
            <View
              key={r.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 13,
                paddingHorizontal: 16,
                borderBottomWidth: i < ROWS.length - 1 ? 0.5 : 0,
                borderBottomColor: theme.hairline,
              }}
            >
              <Text
                style={{
                  flex: 1.5,
                  fontSize: 14,
                  fontWeight: '500',
                  color: theme.text,
                  letterSpacing: -0.2,
                }}
              >
                {r.label}
              </Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {r.free ? <Check color={theme.textMuted} /> : <Dash color={theme.textFaint} />}
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {r.pro ? <Check color={theme.primary} bold /> : <Dash color={theme.textFaint} />}
              </View>
            </View>
          ))}
        </Card>

        {/* Plan cards */}
        {isLoading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={{ color: theme.textMuted, textAlign: 'center', marginBottom: 18 }}>
            Pricing unavailable. Please check your connection.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            {monthly && (
              <PlanCard
                theme={theme}
                label="Monthly"
                price={monthly.product.priceString}
                sub="per month"
                selected={selected?.identifier === monthly.identifier}
                onPress={() => setSelected(monthly)}
              />
            )}
            {annual && (
              <PlanCard
                theme={theme}
                label="Annual"
                price={annual.product.priceString}
                sub={`per year · ${(annual.product.price / 12).toFixed(2)}/mo`}
                selected={selected?.identifier === annual.identifier}
                onPress={() => setSelected(annual)}
                badges={[
                  'Most Popular',
                  ...(monthly && annual ? [`Save ${Math.round((1 - annual.product.price / 12 / monthly.product.price) * 100)}%`] : []),
                  ...(trialEligible ? ['7-day trial'] : []),
                ]}
              />
            )}
          </View>
        )}

        {error && (
          <Text style={{ color: theme.danger, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
        )}

        <PrimaryButton theme={theme} onPress={handlePurchase} loading={isPurchasing} disabled={!selected}>
          {ctaLabel}
        </PrimaryButton>

        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            justifyContent: 'center',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Pressable onPress={handleRestore} disabled={isRestoring} hitSlop={6}>
            <Text style={{ fontSize: 11, color: theme.textFaint, letterSpacing: 0.1 }}>
              {isRestoring ? 'Restoring…' : 'Restore'}
            </Text>
          </Pressable>
          <Text style={{ color: theme.textFaint }}>·</Text>
          <Pressable
            onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            hitSlop={6}
          >
            <Text style={{ fontSize: 11, color: theme.textFaint, letterSpacing: 0.1 }}>Cancel anytime</Text>
          </Pressable>
          <Text style={{ color: theme.textFaint }}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://fastlog.app/terms')} hitSlop={6}>
            <Text style={{ fontSize: 11, color: theme.textFaint, letterSpacing: 0.1 }}>Terms</Text>
          </Pressable>
          <Text style={{ color: theme.textFaint }}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://fastlog.app/privacy')} hitSlop={6}>
            <Text style={{ fontSize: 11, color: theme.textFaint, letterSpacing: 0.1 }}>Privacy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Check({ color, bold }: { color: string; bold?: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M3 8.5l3.2 3L13 4.5"
        stroke={color}
        strokeWidth={bold ? 2.5 : 2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Dash({ color }: { color: string }) {
  return (
    <Svg width={14} height={2} viewBox="0 0 14 2">
      <Rect width={14} height={2} rx={1} fill={color} opacity={0.5} />
    </Svg>
  );
}

function PlanCard({
  theme,
  label,
  price,
  sub,
  selected,
  badges = [],
  onPress,
}: {
  theme: Theme;
  label: string;
  price: string;
  sub: string;
  selected?: boolean;
  badges?: string[];
  onPress?: () => void;
}) {
  const mostPopular = badges.includes('Most Popular');
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        padding: 14,
        paddingBottom: 16,
        borderRadius: 20,
        backgroundColor: theme.surface,
        borderWidth: 2,
        borderColor: selected ? theme.primary : theme.hairline,
        ...(selected ? elevatedShadow(theme.primary) : {}),
      }}
    >
      {mostPopular && (
        <View
          style={{
            position: 'absolute',
            top: -10,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              paddingHorizontal: 9,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: theme.primary,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Most Popular
            </Text>
          </View>
        </View>
      )}
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, letterSpacing: -0.1 }}>{label}</Text>
      <Text
        style={{
          fontSize: 26,
          fontWeight: '700',
          color: theme.text,
          letterSpacing: -0.8,
          marginTop: 4,
          ...TABULAR,
        }}
      >
        {price}
      </Text>
      <Text style={{ fontSize: 11, color: theme.textFaint, marginTop: 2, letterSpacing: 0.1 }}>{sub}</Text>
      {badges.filter(b => b !== 'Most Popular').length > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
          {badges
            .filter(b => b !== 'Most Popular')
            .map(b => (
              <View
                key={b}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: hexAlpha(theme.accent, 0x22),
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.isDark ? theme.accent : '#8A6520',
                    letterSpacing: 0.2,
                  }}
                >
                  {b}
                </Text>
              </View>
            ))}
        </View>
      )}
    </Pressable>
  );
}
