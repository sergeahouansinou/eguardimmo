<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Support\ExportBuilder;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class PurgeExpiredExports
{
    public function __construct(private ExportBuilder $export, private RequestJournal $journal) {}

    public function handle(): int
    {
        $purges = 0;

        PrivacyRequest::query()
            ->whereNotNull('export_path')
            ->whereRaw('export_expires_at < ?', [now()->format('Y-m-d H:i:s.u')])
            ->each(function (PrivacyRequest $demande) use (&$purges): void {
                DB::transaction(function () use ($demande, &$purges): void {
                    $chemin = (string) $demande->export_path;
                    $demande->forceFill(['export_path' => null])->save();
                    $this->journal->record($demande, EventKind::ExportPurged, null);
                    $this->export->delete($chemin);
                    $purges++;
                });
            });

        return $purges;
    }
}
