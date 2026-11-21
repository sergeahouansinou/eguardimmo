<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Support\ItemClaims;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class RemoveCaseItem
{
    public function __construct(
        private ItemClaims $revendications,
        private RecordAudit $audit,
    ) {}

    /**
     * Ferme la ligne (`removed_at`) : rien n'est effacé, la créance redevient libre pour un autre dossier.
     */
    public function handle(RecoveryCase $case, string $itemId): RecoveryCase
    {
        return DB::transaction(function () use ($case, $itemId): RecoveryCase {
            $dossier = RecoveryCase::query()->whereKey($case->id)->lockForUpdate()->firstOrFail();

            if (! $dossier->status->isActive()) {
                throw ErrorCode::CaseNotActive->problem();
            }

            $ligne = (Str::isUuid($itemId)
                ? RecoveryCaseItem::query()->where('case_id', $dossier->id)->whereNull('removed_at')->whereKey($itemId)->lockForUpdate()->first()
                : null) ?? throw ErrorCode::ItemNotFound->problem();

            $ligne->removed_at = Carbon::now();
            $ligne->removed_by_user_id = is_string(auth()->id()) ? auth()->id() : null;
            $ligne->save();
            $this->revendications->release($dossier, $ligne->item_type, $ligne->item_id);

            $this->audit->handle('recovery.case.item_removed', subject: $dossier, metadata: ['item_id' => $ligne->item_id]);

            return $dossier;
        });
    }
}
