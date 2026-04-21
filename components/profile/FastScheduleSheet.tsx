import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore, FastSchedule } from '../../stores/userStore';
import { syncFastSchedule } from '../../lib/fastScheduler';
import { formatHour } from '../../lib/scheduleFormat';

export interface FastScheduleSheetRef {
  present: () => void;
  dismiss: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const FastScheduleSheet = forwardRef<FastScheduleSheetRef, object>(
  function FastScheduleSheet(_, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const profile = useUserStore(s => s.profile);
    const schedule = useUserStore(s => s.fastSchedule);
    const setSchedule = useUserStore(s => s.setFastSchedule);

    const [draft, setDraft] = useState<FastSchedule>(() => ({
      enabled: true,
      days: schedule?.days ?? [1, 2, 3, 4, 5],
      hour: schedule?.hour ?? 20,
      protocol: schedule?.protocol ?? profile?.preferred_protocol ?? '16:8',
    }));

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          setDraft({
            enabled: true,
            days: schedule?.days ?? [1, 2, 3, 4, 5],
            hour: schedule?.hour ?? 20,
            protocol: schedule?.protocol ?? profile?.preferred_protocol ?? '16:8',
          });
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [schedule, profile?.preferred_protocol],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      [],
    );

    const snapPoints = useMemo(() => ['60%'], []);

    function toggleDay(d: number) {
      Haptics.selectionAsync();
      setDraft(prev => {
        const has = prev.days.includes(d);
        const next = has ? prev.days.filter(x => x !== d) : [...prev.days, d];
        return { ...prev, days: next };
      });
    }

    function pickHour(h: number) {
      Haptics.selectionAsync();
      setDraft(prev => ({ ...prev, hour: h }));
    }

    function handleDone() {
      setSchedule(draft.days.length === 0 ? null : draft);
      syncFastSchedule();
      sheetRef.current?.dismiss();
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, letterSpacing: -0.3, marginBottom: 18 }}>
            Fast schedule
          </Text>

          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: theme.textFaint,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Days
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {WEEKDAY_LABELS.map((label, d) => {
              const active = draft.days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.hairline,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#FFFFFF' : theme.text }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: theme.textFaint,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Start time
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 24 }}
            style={{ marginHorizontal: -24, paddingLeft: 24, marginBottom: 20 }}
          >
            {HOURS.map(h => {
              const active = draft.hour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => pickHour(h)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 14,
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderWidth: active ? 0 : 1,
                    borderColor: theme.hairline,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={formatHour(h)}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#FFFFFF' : theme.text }}>
                    {formatHour(h)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={handleDone}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
