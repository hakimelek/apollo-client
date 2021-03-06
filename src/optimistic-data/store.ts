import {
  MutationResultAction,
  isMutationInitAction,
  isMutationResultAction,
  isMutationErrorAction,
} from '../actions';

import {
  data,
} from '../data/store';

import {
  NormalizedCache,
} from '../data/storeUtils';

import {
  QueryStore,
} from '../queries/store';

import {
  MutationStore,
} from '../mutations/store';

import {
  Store,
  ApolloReducerConfig,
} from '../store';

  import { assign } from '../util/assign';

// a stack of patches of new or changed documents
export type OptimisticStore = {
  mutationId: string,
  data: NormalizedCache,
}[];

const optimisticDefaultState: any[] = [];

export function getDataWithOptimisticResults(store: Store): NormalizedCache {
  if (store.optimistic.length === 0) {
    return store.data;
  }
  const patches = store.optimistic.map(opt => opt.data);
  return assign({}, store.data, ...patches) as NormalizedCache;
}

export function optimistic(
  previousState = optimisticDefaultState,
  action: any,
  store: any,
  config: any,
): OptimisticStore {
  if (isMutationInitAction(action) && action.optimisticResponse) {
    const fakeMutationResultAction: MutationResultAction = {
      type: 'APOLLO_MUTATION_RESULT',
      result: { data: action.optimisticResponse },
      document: action.mutation,
      operationName: action.operationName,
      variables: action.variables,
      mutationId: action.mutationId,
      resultBehaviors: action.resultBehaviors,
      extraReducers: action.extraReducers,
      updateQueries: action.updateQueries,
    };

    const fakeStore = {
      ...store,
      optimistic: previousState,
    };
    const optimisticData = getDataWithOptimisticResults(fakeStore);

    const patch = getOptimisticDataPatch(
      optimisticData,
      fakeMutationResultAction,
      store.queries,
      store.mutations,
      config,
    );

    const optimisticState = {
      action: fakeMutationResultAction,
      data: patch,
      mutationId: action.mutationId,
    };

    const newState = [...previousState, optimisticState];

    return newState;
  } else if ((isMutationErrorAction(action) || isMutationResultAction(action))
               && previousState.some(change => change.mutationId === action.mutationId)) {
    // Create a shallow copy of the data in the store.
    const optimisticData = assign({}, store.data);

    const newState = previousState
      // Throw away optimistic changes of that particular mutation
      .filter(change => change.mutationId !== action.mutationId)
      // Re-run all of our optimistic data actions on top of one another.
      .map(change => {
        const patch = getOptimisticDataPatch(
          optimisticData,
          change.action,
          store.queries,
          store.mutations,
          config,
        );
        assign(optimisticData, patch);
        return {
          ...change,
          data: patch,
        };
      });

    return newState;
  }

  return previousState;
}

function getOptimisticDataPatch (
  previousData: NormalizedCache,
  optimisticAction: MutationResultAction,
  queries: QueryStore,
  mutations: MutationStore,
  config: ApolloReducerConfig,
): any {
  const optimisticData = data(
    previousData,
    optimisticAction,
    queries,
    mutations,
    config,
  );

  const patch: any = {};

  Object.keys(optimisticData).forEach(key => {
    if (optimisticData[key] !== previousData[key]) {
      patch[key] = optimisticData[key];
    }
  });

  return patch;
}
