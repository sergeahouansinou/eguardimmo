<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Enums\RemarkAnswer;
use App\Modules\Inspections\Enums\RemarkStatus;
use App\Modules\Inspections\Events\InspectionRemarkAnswered;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class AnswerInspectionRemark
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Une remarque ne reçoit qu'une réponse ; elle ne modifie pas le PDF de l'état des lieux ni ne remplace la saisine de la commission de conciliation.
     */
    public function handle(InspectionRemark $remarque, User $user, RemarkAnswer $decision, string $texte): InspectionRemark
    {
        return DB::transaction(function () use ($remarque, $user, $decision, $texte): InspectionRemark {
            $verrouillee = InspectionRemark::query()->whereKey($remarque->id)->lockForUpdate()->firstOrFail();

            if ($verrouillee->status === RemarkStatus::Answered) {
                throw ErrorCode::InspectionRemarkAnswered->problem();
            }

            $etat = Inspection::query()->findOrFail($verrouillee->inspection_id);
            $verrouillee->forceFill([
                'status' => RemarkStatus::Answered,
                'answer' => $decision,
                'answer_body' => $texte,
                'answered_by_user_id' => $user->id,
                'answered_at' => now(),
            ])->save();

            $this->audit->handle('inspections.remark.answered', $user->id, ['answer' => $decision->value], $verrouillee);
            InspectionRemarkAnswered::dispatch($verrouillee->id, $etat->id, $etat->lease_id, $verrouillee->organization_id, $verrouillee->party_id, $decision->value);

            return $verrouillee->load('files');
        });
    }
}
