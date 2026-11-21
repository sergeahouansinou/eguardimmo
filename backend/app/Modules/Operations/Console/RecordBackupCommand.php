<?php

declare(strict_types=1);

namespace App\Modules\Operations\Console;

use App\Modules\Operations\Actions\RecordBackupReport;
use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Enums\RestoreResult;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Throwable;

/**
 * Appelée par le script de sauvegarde sur l'hôte : aucune route HTTP ne peut déposer ni modifier cette preuve.
 */
final class RecordBackupCommand extends Command
{
    protected $signature = 'operations:record-backup
        {kind : database, documents ou restore_test}
        {--started= : début, format ISO 8601}
        {--duration= : durée en secondes}
        {--size= : taille en octets}
        {--failed : la sauvegarde ou le test a échoué}
        {--manifest= : empreinte SHA-256 du manifeste (64 caractères hexadécimaux)}
        {--target= : cible du test de restauration (40 caractères au plus)}
        {--result= : résultat du test de restauration, passed ou failed}';

    protected $description = 'Enregistre la preuve d\'une sauvegarde ou d\'un test de restauration';

    public function handle(RecordBackupReport $enregistrement): int
    {
        $type = BackupKind::tryFrom((string) $this->argument('kind'));
        $duree = $this->option('duration');
        $taille = $this->option('size');
        $empreinte = $this->option('manifest');
        $cible = $this->option('target');
        $resultat = $this->option('result');
        $debut = $this->debut();
        $erreurs = [];

        $type !== null || $erreurs[] = 'Le type doit valoir database, documents ou restore_test.';
        $debut !== null || $erreurs[] = 'L\'option --started est obligatoire (ISO 8601).';
        (is_string($duree) && ctype_digit($duree)) || $erreurs[] = 'L\'option --duration est obligatoire (secondes, entier).';
        $taille === null || ctype_digit($taille) || $erreurs[] = 'L\'option --size doit être un entier d\'octets.';
        $empreinte === null || preg_match('/^[0-9a-f]{64}$/', $empreinte) === 1 || $erreurs[] = 'L\'option --manifest doit être un SHA-256 en hexadécimal minuscule.';
        $cible === null || ($cible !== '' && mb_strlen($cible) <= 40 && preg_match('/^[A-Za-z0-9._-]+$/', $cible) === 1) || $erreurs[] = 'L\'option --target doit faire 40 caractères au plus (lettres, chiffres, point, tiret).';
        $resultat === null || RestoreResult::tryFrom((string) $resultat) !== null || $erreurs[] = 'L\'option --result doit valoir passed ou failed.';

        if ($type === BackupKind::RestoreTest && ($cible === null || $resultat === null)) {
            $erreurs[] = 'Un test de restauration exige --target et --result.';
        }

        if ($type !== null && $type !== BackupKind::RestoreTest && ($cible !== null || $resultat !== null)) {
            $erreurs[] = '--target et --result ne concernent que restore_test.';
        }

        if ($erreurs !== [] || $type === null || $debut === null) {
            foreach ($erreurs as $erreur) {
                $this->error($erreur);
            }

            return self::INVALID;
        }

        try {
            $rapport = $enregistrement->handle(
                $type,
                $debut,
                (int) $duree,
                ! $this->option('failed'),
                $taille === null ? null : (int) $taille,
                is_string($empreinte) ? $empreinte : null,
                is_string($cible) ? $cible : null,
                is_string($resultat) ? RestoreResult::from($resultat) : null,
            );
        } catch (Throwable $erreur) {
            $this->error('Preuve non enregistrée : '.$erreur::class);

            return self::FAILURE;
        }

        $this->info("Preuve enregistrée : {$rapport->id}");

        return self::SUCCESS;
    }

    private function debut(): ?CarbonImmutable
    {
        $valeur = $this->option('started');

        if (! is_string($valeur) || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/', $valeur) !== 1) {
            return null;
        }

        $date = CarbonImmutable::parse($valeur);

        return $date->isFuture() ? null : $date;
    }
}
