<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Support\StoredFileWriter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Filet de sécurité des fichiers écrits par une transaction qui n'a jamais abouti (processus tué avant le rollback) :
 * un fichier sans ligne `stored_files` et plus ancien que le délai est supprimé et journalisé.
 */
final readonly class SweepOrphanFiles
{
    public const DELAI_HEURES = 24;

    private const LOT = 500;

    /**
     * @return list<string> chemins supprimés
     */
    public function handle(): array
    {
        $disque = Storage::disk(StoredFileWriter::DISK);
        $limite = CarbonImmutable::now()->subHours(self::DELAI_HEURES)->getTimestamp();
        $supprimes = [];

        foreach (array_chunk($disque->allFiles(), self::LOT) as $lot) {
            $connus = DB::table('stored_files')->whereIn('path', $lot)->pluck('path')->all();

            foreach (array_diff($lot, $connus) as $chemin) {
                if ($disque->lastModified($chemin) >= $limite) {
                    continue;
                }

                $disque->delete($chemin);
                $supprimes[] = $chemin;
                Log::warning('Fichier orphelin supprimé', ['disk' => StoredFileWriter::DISK, 'path' => $chemin]);
            }
        }

        return $supprimes;
    }
}
