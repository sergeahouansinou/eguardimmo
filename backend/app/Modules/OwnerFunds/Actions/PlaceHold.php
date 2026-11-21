<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Support\Mandants;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class PlaceHold
{
    public function __construct(
        private Mandants $mandants,
        private OrganizationDirectory $organisations,
        private RecordAudit $audit,
    ) {}

    /**
     * Retenue ou blocage : ne déplace aucun argent. Une modification est une levée puis une nouvelle retenue.
     */
    public function handle(string $mandantId, HoldKind $genre, ?int $montant, HoldReason $motif, ?string $commentaire, ?string $userId): PayoutHold
    {
        $this->mandants->assertExists($mandantId);
        $devise = $this->organisations->currency();

        return DB::transaction(function () use ($mandantId, $genre, $montant, $motif, $commentaire, $userId, $devise): PayoutHold {
            $retenue = PayoutHold::query()->create([
                'mandant_party_id' => $mandantId,
                'kind' => $genre,
                'amount' => $genre === HoldKind::Reserve && $montant !== null ? new Money($montant, $devise) : null,
                'currency' => $devise->getCode(),
                'reason' => $motif,
                'comment' => $commentaire,
                'placed_by_user_id' => $userId,
            ]);
            $this->audit->handle('ownerfunds.hold.placed', subject: $retenue, metadata: ['mandant_party_id' => $mandantId, 'kind' => $genre->value, 'reason' => $motif->value]);

            return $retenue;
        });
    }
}
