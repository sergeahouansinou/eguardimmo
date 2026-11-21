<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Inspections\Models\InspectionRemark;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ErasePartyRemarks
{
    public const string TEXTE = '[effacé]';

    public function __construct(private RecordAudit $audit) {}

    /**
     * Seuls les textes libres sont effacés ; la nature, le statut et la décision de l'équipe restent. Idempotent.
     *
     * @return int remarques dont un texte a été remplacé
     */
    public function handle(string $partyId): int
    {
        return DB::transaction(function () use ($partyId): int {
            $remarques = InspectionRemark::query()
                ->where('party_id', $partyId)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->filter(fn (InspectionRemark $r): bool => $r->body !== self::TEXTE || ($r->answer_body !== null && $r->answer_body !== self::TEXTE))
                ->values();

            foreach ($remarques as $remarque) {
                $remarque->forceFill(['body' => self::TEXTE, 'answer_body' => $remarque->answer_body === null ? null : self::TEXTE])->save();
            }

            if ($remarques->isNotEmpty()) {
                $this->audit->handle('inspections.remarks.erased', null, ['remarks' => $remarques->count()], $remarques->first());
            }

            return $remarques->count();
        });
    }
}
