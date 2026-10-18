import { createUnifiedRetrieval } from '../../ai/retrieval';
import { createToolExecutor } from '../../ai/toolExecutor';
import { ItineraryPreviewOwner } from '../../ai/itineraryPreview';
import { UUID } from '../../data/parser';
import { approvedEvidence, lexicalAlternatives, matchesLexicalText } from '../../data/lexical';
import { filterMenuItems } from './menuFilter';
import type { EvaluationCase, EvaluationInputs } from './contracts';
import type { Place } from '../../contracts';

/** A fresh isolated memory graph per row. Never imports store, SQLite, packs or app retrieval. */
export function createFixtureLane(
  inputs: EvaluationInputs,
  question: EvaluationCase,
  onMapIntent: (place: Place) => void,
) {
  const places = JSON.parse(JSON.stringify(inputs.places)) as Place[];
  if (
    places.some(
      (place) => !UUID.test(place.id) || place.coordinate !== null || place.entrances.length,
    )
  )
    throw new Error('Invalid isolated fixture graph');
  const approved = (place: Place) =>
    place.status === 'approved' && place.citations.every((c) => approvedEvidence(c));
  const retrieval = createUnifiedRetrieval({
    findPlaces: async (filters) => {
      const terms = lexicalAlternatives(filters.query ?? '');
      return places
        .filter(
          (place) =>
            approved(place) &&
            (!filters.category || filters.category === place.category) &&
            matchesLexicalText(
              [
                place.name,
                place.category,
                place.building,
                ...place.aliases,
                ...place.menus.map((item) => item.name),
              ]
                .filter(Boolean)
                .join(' '),
              terms,
            ),
        )
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    },
    getPlaceDetails: async (id) => places.find((place) => place.id === id) ?? null,
    findMenuItems: async (filters) => filterMenuItems(places, filters),
    loadSaved: async () => {
      throw new Error('EVALUATION_SAVED_STORE_FORBIDDEN');
    },
    searchOffices: () => ({ items: [], total: 0 }),
    getOfficeDetails: () => null,
  });
  const preview = new ItineraryPreviewOwner(
    async (id) => (await retrieval.getPlaceDetails(id)).data,
  );
  const executor = createToolExecutor(retrieval, {
    getItineraryPreview: (signal) => preview.read(signal),
    previewItinerary: (stops, requestId, operation, signal) =>
      preview.preview(stops, requestId, operation, signal),
    cancelPending: () => preview.cancelPending(),
    // No synthetic coordinate exists. Record the attempt; do not focus production map.
    focusMapPlace: (place) => {
      onMapIntent(place);
      return false;
    },
  });
  const resolvedPlaceIds = [
    ...new Set(
      question.history.flatMap((message) =>
        message.role === 'assistant' ? (message.entityIds ?? []) : [],
      ),
    ),
  ]
    .filter((id) => places.some((place) => place.id === id && approved(place)))
    .slice(0, 12);
  return { retrieval, executor, preview, resolvedPlaceIds };
}
