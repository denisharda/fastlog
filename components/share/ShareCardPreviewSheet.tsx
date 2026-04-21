import { forwardRef, useCallback, useImperativeHandle, useRef, useState, RefObject } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { FastingSession } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { ShareCard } from './ShareCard';
import { captureAndShare } from '../../lib/captureShareCard';

export interface ShareCardPreviewSheetRef {
  present: (args: PresentArgs) => void;
  dismiss: () => void;
}

interface PresentArgs {
  session: FastingSession;
  waterMl?: number;
  source: 'history' | 'fast_complete';
}

export const ShareCardPreviewSheet = forwardRef<ShareCardPreviewSheetRef, object>(
  function ShareCardPreviewSheet(_, ref) {
    const theme = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const cardRef = useRef<View | null>(null);
    const [args, setArgs] = useState<PresentArgs | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        present: (a: PresentArgs) => {
          setArgs(a);
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      [],
    );

    async function handleShare() {
      if (!args || isSharing) return;
      setIsSharing(true);
      try {
        await captureAndShare({ ref: cardRef as RefObject<View>, session: args.session, source: args.source });
      } finally {
        setIsSharing(false);
      }
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['85%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.hairline, width: 40, height: 4 }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.2,
              color: theme.textFaint,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Preview
          </Text>

          {args && (
            <View style={{ borderRadius: 20, overflow: 'hidden' }}>
              <ShareCard
                ref={cardRef}
                session={args.session}
                waterMl={args.waterMl}
                theme={theme}
              />
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={handleShare}
            disabled={isSharing || !args}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: 'center',
              alignSelf: 'stretch',
              marginTop: 16,
              opacity: isSharing ? 0.7 : 1,
            }}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Share</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            style={{ paddingVertical: 12, alignItems: 'center', alignSelf: 'stretch' }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '500' }}>Cancel</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
