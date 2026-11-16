<?php

declare(strict_types=1);

use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Shared\Http\ApiProblem;

function regimeRegistre(): LeaseRegimes
{
    return app(LeaseRegimes::class);
}

/**
 * @return list<class-string<LeaseRegime>>
 */
function regimeClassesDuDossier(string $dossier, string $espace): array
{
    $classes = [];

    foreach (glob($dossier.'/*Regime.php') ?: [] as $fichier) {
        $classe = $espace.'\\'.basename($fichier, '.php');

        if (is_subclass_of($classe, LeaseRegime::class)) {
            $classes[] = $classe;
        }
    }

    return $classes;
}

function regimeProbleme(Closure $appel): ?string
{
    try {
        $appel();
    } catch (ApiProblem $e) {
        return $e->problemCode.':'.$e->status;
    }

    return null;
}

it('ouvre uniquement la France', function (): void {
    expect(regimeRegistre()->jurisdictions())->toBe(['FR']);
});

it('liste les quatre régimes français', function (): void {
    $cles = array_map(fn (LeaseRegime $regime): string => $regime->key(), regimeRegistre()->all('FR'));

    expect($cles)->toBe(['fr.residential.unfurnished', 'fr.residential.furnished', 'fr.residential.mobility', 'fr.common_law']);
});

it('renvoie le régime de la clé demandée', function (string $cle): void {
    expect(regimeRegistre()->for('FR', $cle)->key())->toBe($cle)
        ->and(regimeRegistre()->supports('FR', $cle))->toBeTrue();
})->with(['fr.residential.unfurnished', 'fr.residential.furnished', 'fr.residential.mobility', 'fr.common_law']);

it('refuse toute juridiction hors France sans repli', function (string $pays): void {
    expect(regimeProbleme(fn () => regimeRegistre()->for($pays, 'fr.residential.unfurnished')))->toBe('jurisdiction_unsupported:422')
        ->and(regimeProbleme(fn () => regimeRegistre()->all($pays)))->toBe('jurisdiction_unsupported:422')
        ->and(regimeRegistre()->supports($pays, 'fr.residential.unfurnished'))->toBeFalse();
})->with(['BE', 'LU', 'CA', 'BJ', 'fr', '']);

it('refuse une clé de régime inconnue ou d\'une autre juridiction', function (string $cle): void {
    expect(regimeProbleme(fn () => regimeRegistre()->for('FR', $cle)))->toBe('jurisdiction_unsupported:422')
        ->and(regimeRegistre()->supports('FR', $cle))->toBeFalse();
})->with(['fr.residential.unknown', 'be.residential.unfurnished', 'FR.RESIDENTIAL.UNFURNISHED', '']);

it('enregistre chaque régime du dossier Fr', function (): void {
    $classes = regimeClassesDuDossier(app_path('Modules/Leases/Jurisdictions/Fr'), 'App\\Modules\\Leases\\Jurisdictions\\Fr');
    $enregistres = array_map(fn (LeaseRegime $regime): string => $regime::class, regimeRegistre()->all('FR'));

    expect($classes)->toHaveCount(4)
        ->and($enregistres)->toEqualCanonicalizing($classes);
});

it('n\'enregistre aucun régime sans entrée de registre ni clé en double', function (): void {
    $total = 0;

    foreach (regimeRegistre()->jurisdictions() as $juridiction) {
        $cles = array_map(fn (LeaseRegime $regime): string => $regime->key(), regimeRegistre()->all($juridiction));
        $total += count($cles);

        expect($cles)->toBe(array_values(array_unique($cles)));
    }

    $classes = regimeClassesDuDossier(app_path('Modules/Leases/Jurisdictions/Fr'), 'App\\Modules\\Leases\\Jurisdictions\\Fr');

    expect($total)->toBe(count($classes));
});

it('garde des clés de régime au format accepté par la colonne et la juridiction du bail', function (): void {
    foreach (regimeRegistre()->jurisdictions() as $juridiction) {
        foreach (regimeRegistre()->all($juridiction) as $regime) {
            expect($regime->jurisdiction())->toBe($juridiction)
                ->and($regime->key())->toMatch('/^[a-z]{2}(\.[a-z_]+)+$/')
                ->and(mb_strlen($regime->key()))->toBeLessThanOrEqual(80)
                ->and($regime->key())->toStartWith(mb_strtolower($juridiction).'.')
                ->and($regime->currency())->toMatch('/^[A-Z]{3}$/');
        }
    }
});

it('accepte la clé de régime par défaut de la fabrique de baux', function (): void {
    $bail = Lease::factory()->make();

    expect(regimeRegistre()->supports($bail->jurisdiction, $bail->regime_key))->toBeTrue();
});

it('cohérence entre ses règles de validation et son schéma de champs', function (): void {
    foreach (regimeRegistre()->all('FR') as $regime) {
        $cles = array_map(fn ($champ): string => $champ->key, $regime->jurisdictionDataFields());

        expect(array_keys($regime->jurisdictionDataRules()))->toBe($cles);
    }
});
