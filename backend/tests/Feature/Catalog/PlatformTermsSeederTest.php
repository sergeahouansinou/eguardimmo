<?php

declare(strict_types=1);

use App\Modules\Catalog\Database\Seeders\PlatformTermsSeeder;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Support\PlatformTerms;
use App\Modules\Catalog\Support\TermMetadata;
use Illuminate\Support\Facades\DB;

it('est idempotent : relancé, il ne duplique rien et conserve les identifiants', function (): void {
    $this->seed(PlatformTermsSeeder::class);
    $ids = Term::query()->orderBy('vocabulary')->orderBy('key')->pluck('id')->all();

    $this->seed(PlatformTermsSeeder::class);

    expect(Term::query()->count())->toBe(count(PlatformTerms::all()))
        ->and(Term::query()->orderBy('vocabulary')->orderBy('key')->pluck('id')->all())->toBe($ids)
        ->and(Term::query()->whereNotNull('organization_id')->count())->toBe(0)
        ->and(Term::query()->where('is_system', false)->count())->toBe(0);
});

it('restaure un libellé modifié en base mais ne désarchive pas une valeur', function (): void {
    $this->seed(PlatformTermsSeeder::class);
    $valeur = Term::query()->where('key', 'bailiff')->firstOrFail();
    DB::table('terms')->where('id', $valeur->id)->update(['labels' => json_encode(['fr' => 'Huissier']), 'archived_at' => now()]);

    $this->seed(PlatformTermsSeeder::class);

    $valeur->refresh();
    expect($valeur->labels)->toBe(['fr' => 'Commissaire de justice'])
        ->and($valeur->archived_at)->not->toBeNull();
});

it('fournit le commissaire de justice exigé par l\'ADR 0023', function (): void {
    $this->seed(PlatformTermsSeeder::class);

    $valeur = Term::query()->where('vocabulary', 'contact_category')->where('key', 'bailiff')->firstOrFail();

    expect($valeur->semantic_key)->toBe('bailiff')
        ->and($valeur->labels['fr'])->toBe('Commissaire de justice')
        ->and($valeur->organization_id)->toBeNull();
});

it('porte chaque sens système connu du code, et rien d\'autre', function (): void {
    $this->seed(PlatformTermsSeeder::class);

    foreach (VocabularyKey::cases() as $vocabulaire) {
        $enBase = Term::query()->where('vocabulary', $vocabulaire->value)->whereNotNull('semantic_key')->pluck('semantic_key')->unique()->sort()->values()->all();
        $connus = collect($vocabulaire->semantics())->sort()->values()->all();

        expect($enBase)->toBe($connus, "sens du référentiel {$vocabulaire->value}");
    }
});

it('ne sème que des valeurs conformes à la déclaration du référentiel', function (): void {
    foreach (PlatformTerms::all() as $ligne) {
        $vocabulaire = $ligne['vocabulary'];

        expect($ligne['key'])->toMatch('/^[a-z][a-z0-9_]{0,62}$/')
            ->and($ligne['semantic'] === null || in_array($ligne['semantic'], $vocabulaire->semantics(), true))->toBeTrue("{$ligne['key']}")
            ->and($vocabulaire->semanticRequired() ? $ligne['semantic'] !== null : true)->toBeTrue("{$ligne['key']}")
            ->and(TermMetadata::validated($vocabulaire, $ligne['metadata']))->toBe($ligne['metadata']);
    }
});
