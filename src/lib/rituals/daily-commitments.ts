export type CommitmentOption = { due_on: string | null; id: string; title: string };

export const foundingCommitmentLabel = "Founded this GYST ledger (day one)";

/**
 * The commitments a daily ritual may score as its previous commitment.
 *
 * Until the owner has committed a first daily ritual, the founding commitment
 * created by `commit_onboarding` is offered first, so day one has a true prior
 * promise to score. It is already completed, so it never appears in the active
 * list that the next-commitment select draws from. An owner with no onboarding
 * row sees exactly the active list, as before.
 */
export function previousCommitmentOptions({
  active,
  founding,
  hasCommittedDaily,
}: {
  active: CommitmentOption[];
  founding: CommitmentOption | null;
  hasCommittedDaily: boolean;
}): CommitmentOption[] {
  if (!founding || hasCommittedDaily) {
    return active;
  }

  return [{ ...founding, title: foundingCommitmentLabel }, ...active.filter((commitment) => commitment.id !== founding.id)];
}
