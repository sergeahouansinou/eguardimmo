<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Enums\ScheduleReason;
use App\Modules\Investments\Enums\ScheduleSource;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\FrozenYears;
use App\Modules\Investments\Support\LoanLock;
use App\Modules\Investments\Support\ScheduleImport;
use App\Modules\Investments\Support\ScheduleWriter;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Le tableau de la banque remplace le calcul (ADR 0039) après vérification du chaînage et de la somme du capital.
 */
final readonly class ImportLoanSchedule
{
    public function __construct(
        private LoanLock $verrou,
        private FrozenYears $figees,
        private ScheduleImport $import,
        private ScheduleWriter $echeanciers,
        private RecordAudit $audit,
    ) {}

    public function handle(string $loanId, UploadedFile $fichier, int $lockVersion): Loan
    {
        return DB::transaction(function () use ($loanId, $fichier, $lockVersion): Loan {
            $pret = $this->verrou->lock($loanId, $lockVersion);
            $this->verrou->assertActive($pret);

            $rows = $this->import->parse($fichier, Currencies::decimals($pret->currency), (int) $pret->principal->getAmount());
            $this->figees->assertUntouched($pret, $this->echeanciers->latest($pret->id), $rows);
            $this->echeanciers->write($pret, $rows, ScheduleReason::Import, $rows[0]->dueOn);
            $pret->forceFill(['schedule_source' => ScheduleSource::Imported->value, 'lock_version' => $pret->lock_version + 1])->save();
            $this->audit->handle('investments.loan.imported', subject: $pret);

            return $pret;
        });
    }
}
