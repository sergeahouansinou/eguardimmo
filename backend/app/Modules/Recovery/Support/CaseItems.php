<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Queries\OpenItems;
use Illuminate\Support\Carbon;

/**
 * Inclusion de créances dans un dossier. À appeler sous le verrou de l'organisation (`CaseLock`) : le contrôle « une
 * créance, un seul dossier actif » et l'écriture de la ligne forment un tout.
 */
final readonly class CaseItems
{
    public function __construct(
        private OpenItems $pris,
        private ItemClaims $revendications,
    ) {}

    /**
     * @param  list<Receivable>  $creances
     */
    public function include(RecoveryCase $dossier, array $creances): void
    {
        if ($this->pris->takenByReceivables($creances) !== []) {
            throw ErrorCode::ReceivableTaken->problem();
        }

        foreach ($creances as $creance) {
            if ($creance->outstanding->getCurrency()->getCode() !== $dossier->currency) {
                throw ErrorCode::ReceivableInvalid->problem();
            }

            $this->revendications->claim($dossier, $creance->type, $creance->id);

            RecoveryCaseItem::query()->create([
                'case_id' => $dossier->id,
                'item_type' => $creance->type,
                'item_id' => $creance->id,
                'reference' => $creance->reference,
                'currency' => $dossier->currency,
                'period_start' => $creance->periodStart ?? $creance->issuedOn,
                'period_end' => $creance->periodEnd ?? $creance->issuedOn,
                'due_date' => $creance->dueDate,
                'total_amount' => $creance->total,
                'amount_due' => $creance->outstanding,
                'included_at' => Carbon::now(),
                'included_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);
        }
    }
}
