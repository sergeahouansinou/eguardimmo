<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\Models\StoredFile;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final class FilesToScan
{
    public const int LOT = 500;

    /**
     * Fichiers dont l'analyse n'a pas abouti : `unverifiable`, `pending` depuis trop longtemps (travail en file perdu) et, quand un analyseur
     * est actif, fichiers déposés avant l'antivirus (`clean` sans date d'analyse). Tri par dernière tentative, jamais tentés d'abord : un lot
     * de fichiers toujours injoignables ne bloque pas les suivants.
     *
     * @return list<array{id: string, organization_id: string}>
     */
    public function stalled(CarbonImmutable $pendantAvant, bool $avecAnciens, int $limite = self::LOT): array
    {
        return array_values(AcrossOrganizations::query(StoredFile::class)
            ->where(fn ($q) => $q->where('scan_status', ScanStatus::Unverifiable->value)
                ->orWhere(fn ($pending) => $pending->where('scan_status', ScanStatus::Pending->value)->where('created_at', '<', $pendantAvant->format('Y-m-d H:i:s.u')))
                ->when($avecAnciens, fn ($q) => $q->orWhere(fn ($ancien) => $ancien->where('scan_status', ScanStatus::Clean->value)->whereNull('scanned_at')->whereIn('category', FileCategory::scanned()))))
            ->orderByRaw('scan_attempted_at is not null')
            ->orderBy('scan_attempted_at')
            ->orderBy('id')
            ->limit($limite)
            ->get(['id', 'organization_id'])
            ->map(fn (StoredFile $f): array => ['id' => $f->id, 'organization_id' => $f->organization_id])
            ->all());
    }

    public function unverifiableCount(): int
    {
        return AcrossOrganizations::query(StoredFile::class)->where('scan_status', ScanStatus::Unverifiable->value)->count();
    }
}
