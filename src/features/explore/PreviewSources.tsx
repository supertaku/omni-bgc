import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, palette } from '../../ui/components';
import { previewDetails } from '../../preview/directory';

export function PreviewSources({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const details = previewDetails(id);
  if (!details) return null;
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={() => setOpen(value => !value)} style={{minHeight:48,justifyContent:'center'}}>
      <Text style={{color:palette.muted,fontFamily:'OmniBodySemiBold'}}>Sources & enrichment {open ? '−' : '+'}</Text>
    </Pressable>
    {open ? <View style={{gap:6}}>
      <Body muted>Generated descriptions, menu additions, estimated prices and illustrative images support this internal preview. They are distinguishable from sourced facts below.</Body>
      <Text selectable style={{fontSize:12,color:palette.muted}}>{JSON.stringify(details, null, 2)}</Text>
    </View> : null}
  </View>;
}
