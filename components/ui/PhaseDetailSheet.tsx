import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { PhaseDef, Theme, hexAlpha } from '../../constants/theme';

interface PhaseDetailSheetProps {
  visible: boolean;
  phase: PhaseDef | null;
  phaseColor: string;
  theme: Theme;
  onClose: () => void;
}

/** Bottom sheet showing full detail for a single fasting phase. */
export function PhaseDetailSheet({ visible, phase, phaseColor, theme, onClose }: PhaseDetailSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const snapPoints = useMemo(() => ['70%', '92%'], []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

  if (!phase) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 4 }}
      >
        {/* Phase pill + range */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: hexAlpha(phaseColor, 0x22),
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: phaseColor,
              }}
            >
              {phase.short}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: theme.textFaint,
              letterSpacing: 0.5,
            }}
          >
            {phase.range}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: theme.text,
            letterSpacing: -0.6,
            lineHeight: 32,
          }}
        >
          {phase.name}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.textMuted,
            marginTop: 6,
            letterSpacing: -0.1,
            lineHeight: 20,
          }}
        >
          {phase.description}
        </Text>

        {/* Science paragraph */}
        <View
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 16,
            backgroundColor: theme.surface2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: theme.textFaint,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            What's happening
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.text,
              lineHeight: 21,
              letterSpacing: -0.1,
            }}
          >
            {phase.science}
          </Text>
        </View>

        {/* Tips */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.textFaint,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 22,
            marginBottom: 10,
          }}
        >
          What to do
        </Text>
        <View style={{ gap: 10 }}>
          {phase.tips.map(tip => (
            <View
              key={tip}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: hexAlpha(phaseColor, 0x22),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                  <Path
                    d="M1.5 5l2.5 2.5L8.5 2"
                    stroke={phaseColor}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: theme.text,
                  lineHeight: 20,
                  letterSpacing: -0.1,
                }}
              >
                {tip}
              </Text>
            </View>
          ))}
        </View>

        {/* Metabolic markers */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.textFaint,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 22,
            marginBottom: 10,
          }}
        >
          Metabolic markers
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.hairline,
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ marginTop: 2 }}>
            <Circle cx={8} cy={8} r={6.5} stroke={theme.textMuted} strokeWidth={1.4} />
            <Path
              d="M8 5v3.5l2 1.5"
              stroke={theme.textMuted}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: theme.textMuted,
              lineHeight: 19,
              letterSpacing: -0.1,
            }}
          >
            {phase.metabolicMarkers}
          </Text>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
