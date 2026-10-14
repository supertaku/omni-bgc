import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import type { Place } from '../contracts';
import { matchesCategory } from '../features/explore/directory';

export type Panel =
  'search' | 'filters' | 'peek' | 'sources' | 'saved' | 'itinerary' | 'pack' | null;
export function useExplorerNavigation(confirming: boolean, installing: boolean) {
  const [tab, setTab] = useState<'Map' | 'Assistant'>('Map');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('All');
  const [returnPanel, setReturnPanel] = useState<Panel>(null);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true)),
      hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const setTabSafely = useCallback(
    (next: 'Map' | 'Assistant') => {
      if (next === tab || confirming || installing) return;
      Keyboard.dismiss();
      setTab(next);
    },
    [tab, confirming, installing],
  );
  const dismiss = useCallback(() => {
    if (keyboard) {
      Keyboard.dismiss();
      return;
    }
    if (tab === 'Assistant') {
      setTabSafely('Map');
      return;
    }
    if (panel === 'sources') {
      setPanel(selected ? 'peek' : 'pack');
      return;
    }
    if (panel === 'filters') {
      setPanel(returnPanel);
      return;
    }
    if (panel) {
      setPanel(null);
      setSelected(null);
    }
  }, [keyboard, tab, setTabSafely, panel, selected, returnPanel]);
  useEffect(() => {
    const b = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboard || panel || tab === 'Assistant') {
        dismiss();
        return true;
      }
      return false;
    });
    return () => b.remove();
  }, [keyboard, panel, tab, selected, returnPanel, confirming, installing, dismiss]);
  const open = (next: Panel) => {
    Keyboard.dismiss();
    setPanel(next);
  };
  const choose = (place: Place) => {
    Keyboard.dismiss();
    if (!matchesCategory(place, category)) setCategory('All');
    setSelected(place);
    setPanel('peek');
  };

  return {
    tab,
    panel,
    selected,
    query,
    category,
    returnPanel,
    keyboard,
    setTabSafely,
    dismiss,
    open,
    choose,
    setPanel,
    setSelected,
    setQuery,
    setCategory,
    setReturnPanel,
  };
}
