<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Revendication d'une créance par un dossier actif : la clé primaire (organisation, type, créance) de `recovery_item_claims`
 * porte la règle « une créance, un seul dossier actif » jusque dans la base. Table d'état dérivée de `recovery_case_items`
 * (rebâtissable) : une revendication se libère par suppression, les lignes de créance, elles, ne s'effacent jamais.
 */
final readonly class ItemClaims
{
    private const string TABLE = 'recovery_item_claims';

    public function __construct(private CurrentOrganization $organisation) {}

    public function claim(RecoveryCase $dossier, ItemType $type, string $itemId): void
    {
        try {
            DB::table(self::TABLE)->insert([
                'organization_id' => $this->organisation->id(),
                'item_type' => $type->value,
                'item_id' => $itemId,
                'case_id' => $dossier->id,
                'created_at' => Carbon::now()->format('Y-m-d H:i:s.u'),
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::ReceivableTaken->problem();
        }
    }

    public function release(RecoveryCase $dossier, ItemType $type, string $itemId): void
    {
        DB::table(self::TABLE)->where(['organization_id' => $this->organisation->id(), 'case_id' => $dossier->id, 'item_type' => $type->value, 'item_id' => $itemId])->delete();
    }

    public function releaseAll(RecoveryCase $dossier): void
    {
        DB::table(self::TABLE)->where(['organization_id' => $this->organisation->id(), 'case_id' => $dossier->id])->delete();
    }
}
