<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use Illuminate\Support\Facades\DB;

final readonly class UpdateReport
{
    public function __construct(private MandantLock $verrou, private GenerateReport $generation) {}

    /**
     * Changements en liste blanche d'un brouillon ou d'un compte rendu généré ; verrou optimiste sur `lock_version`. Un
     * compte rendu généré est recalculé pour que ses sections et options se retrouvent dans l'instantané.
     *
     * @param  array{sections?: list<string>, options?: array<string, bool>, notify?: bool}  $changements
     */
    public function handle(ManagementReport $rapport, int $versionLue, array $changements): ManagementReport
    {
        return DB::transaction(function () use ($rapport, $versionLue, $changements): ManagementReport {
            $this->verrou->acquire($rapport->mandant_party_id);
            $courant = ManagementReport::query()->whereKey($rapport->id)->lockForUpdate()->firstOrFail();

            if (! $courant->status->isEditable()) {
                throw ErrorCode::NotEditable->problem();
            }

            if ($courant->lock_version !== $versionLue) {
                throw ErrorCode::StaleVersion->problem();
            }

            if (isset($changements['sections'])) {
                $courant->content = ['sections' => $changements['sections']];
            }

            if (isset($changements['options'])) {
                $courant->options = [...$courant->options, ...$changements['options']];
            }

            if (isset($changements['notify'])) {
                $courant->notify = $changements['notify'];
            }

            if ($courant->status === ReportStatus::Generated) {
                $courant->save();

                return $this->generation->handle($courant);
            }

            $courant->lock_version++;
            $courant->save();

            return $courant;
        });
    }
}
