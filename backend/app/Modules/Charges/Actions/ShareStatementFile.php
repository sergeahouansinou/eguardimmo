<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Support\Locks;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ShareStatementFile
{
    public function __construct(
        private Locks $verrous,
        private ChargeRulesRegistry $juridictions,
        private RecordAudit $audit,
    ) {}

    /**
     * Publie ou retire une pièce au locataire : visible jusqu'à la durée minimale de mise à disposition de la juridiction après l'émission.
     */
    public function handle(string $statementId, string $fileId, bool $visible): ChargeStatementFile
    {
        $exerciceId = ChargeStatement::query()->whereKey($statementId)->value('exercise_id');

        if (! is_string($exerciceId) || ! Str::isUuid($fileId)) {
            throw ErrorCode::StatementNotFound->problem();
        }

        return DB::transaction(function () use ($statementId, $fileId, $visible, $exerciceId): ChargeStatementFile {
            $exercice = $this->verrous->exerciseOfProperty($exerciceId);
            $decompte = $this->verrous->statement($statementId);

            if (! in_array($decompte->status, [StatementStatus::Issued, StatementStatus::Superseded], true)) {
                throw ErrorCode::StatementStateInvalid->problem('Les pièces se publient une fois le décompte émis.');
            }

            $piece = ChargeStatementFile::query()->where('statement_id', $decompte->id)->whereKey($fileId)->first() ?? throw ErrorCode::FileNotFound->problem();
            $emisLe = CarbonImmutable::parse($decompte->issued_at);
            $mois = $this->juridictions->for($exercice->jurisdiction)->documentAvailabilityMonths($emisLe);
            $piece->forceFill(['tenant_visible' => $visible, 'visible_until' => $visible ? $emisLe->addMonths($mois)->toDateString() : null])->save();
            $this->audit->handle($visible ? 'charges.file.shared' : 'charges.file.unshared', subject: $decompte, metadata: ['file_id' => $piece->id]);

            return $piece;
        });
    }
}
