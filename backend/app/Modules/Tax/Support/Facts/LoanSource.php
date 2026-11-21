<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support\Facts;

use App\Modules\Investments\PublicApi\LoanCosts;
use App\Modules\Tax\Data\FactEntryData;

/**
 * Ligne 250 : attestation de la banque si elle existe, sinon échéancier et frais payés dans l'année. Un bien qui a un prêt suivi et une
 * dépense « intérêts d'emprunt » pour l'année bloque la synthèse : les deux sources sont écartées, rien n'est choisi à la place de l'utilisateur.
 */
final readonly class LoanSource
{
    public function __construct(private LoanCosts $prets) {}

    /**
     * @param  array<string, list<FactEntryData>>  $interetsDepenses  dépenses « intérêts d'emprunt » par bien
     * @return array{entries: list<FactEntryData>, blockers: list<array{code: string, property_id: string}>, loanIds: list<string>}
     */
    public function read(int $annee, array $interetsDepenses): array
    {
        $entrees = [];
        $bloques = [];
        $pretsUtilises = [];

        foreach ($this->prets->deductible($annee) as $cout) {
            if (isset($interetsDepenses[$cout->propertyId])) {
                $bloques[$cout->propertyId] = ['code' => 'interest_source_conflict', 'property_id' => $cout->propertyId];

                continue;
            }

            $total = (int) $cout->interest->add($cout->insurance)->add($cout->fees)->getAmount();
            $entrees[] = new FactEntryData($cout->propertyId, '250', $total, $cout->source === 'attestation' ? FactEntryData::LOAN_ATTESTATION : FactEntryData::LOAN_SCHEDULE, $cout->loanId);
            $pretsUtilises[] = $cout->loanId;
        }

        foreach ($interetsDepenses as $bien => $depenses) {
            if (! isset($bloques[$bien])) {
                array_push($entrees, ...$depenses);
            }
        }

        return ['entries' => $entrees, 'blockers' => array_values($bloques), 'loanIds' => array_values(array_unique($pretsUtilises))];
    }
}
