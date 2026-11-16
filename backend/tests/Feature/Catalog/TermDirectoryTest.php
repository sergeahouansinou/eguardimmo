<?php

declare(strict_types=1);

use App\Modules\Catalog\Actions\ArchiveTerm;
use App\Modules\Catalog\Actions\CreateTerm;
use App\Modules\Catalog\Actions\OverrideTerm;
use App\Modules\Catalog\Data\NewTermData;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\MissingOrganizationContext;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->autre = C::organisation();
    $this->annuaire = app(TermDirectory::class);
});

function catalogueCreerValeur(object $org, string $cle = 'ramonage'): TermData
{
    return C::dans($org, fn (): TermData => app(CreateTerm::class)->handle(
        VocabularyKey::ExpenseCategory,
        new NewTermData($cle, ['fr' => 'Ramonage'], 'expense.maintenance', null, []),
    ));
}

function catalogueRefus(Closure $appel): ?string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return null;
}

it('résout une valeur de la plateforme ou de l\'organisation courante avec son sens système', function (): void {
    $propre = catalogueCreerValeur($this->org);
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'bailiff')->firstOrFail();

    C::dans($this->org, function () use ($propre, $plateforme): void {
        $trouvee = $this->annuaire->find($propre->id, VocabularyKey::ExpenseCategory);
        $huissier = $this->annuaire->find($plateforme->id, VocabularyKey::ContactCategory);

        expect($trouvee->key)->toBe('ramonage')
            ->and($trouvee->semanticKey)->toBe('expense.maintenance')
            ->and($trouvee->isPlatform)->toBeFalse()
            ->and($huissier->semanticKey)->toBe('bailiff')
            ->and($huissier->label())->toBe('Commissaire de justice');
    });
});

it('refuse la valeur d\'une autre organisation, d\'un autre référentiel ou inexistante : term_not_found', function (): void {
    $etrangere = catalogueCreerValeur($this->autre);
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'bailiff')->firstOrFail();

    C::dans($this->org, function () use ($etrangere, $plateforme): void {
        expect(catalogueRefus(fn () => $this->annuaire->find($etrangere->id, VocabularyKey::ExpenseCategory)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->find($plateforme->id, VocabularyKey::UnitType)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->find(fake()->uuid(), VocabularyKey::UnitType)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->find('pas-un-uuid', VocabularyKey::UnitType)))->toBe('term_not_found');
    });
});

it('exige un contexte d\'organisation', function (): void {
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'bailiff')->firstOrFail();

    expect(fn () => $this->annuaire->find($plateforme->id, VocabularyKey::ContactCategory))->toThrow(MissingOrganizationContext::class);
});

it('refuse d\'affecter une valeur archivée ou masquée, mais la résout encore', function (): void {
    $propre = catalogueCreerValeur($this->org);
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'notary')->firstOrFail();

    C::dans($this->org, function () use ($propre, $plateforme): void {
        app(ArchiveTerm::class)->handle(Term::query()->findOrFail($propre->id), true);
        app(OverrideTerm::class)->handle($plateforme, null, true, null);

        expect($this->annuaire->find($propre->id, VocabularyKey::ExpenseCategory)->isArchived)->toBeTrue()
            ->and($this->annuaire->find($plateforme->id, VocabularyKey::ContactCategory)->isHidden)->toBeTrue()
            ->and(catalogueRefus(fn () => $this->annuaire->findAssignable($propre->id, VocabularyKey::ExpenseCategory)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->findAssignable($plateforme->id, VocabularyKey::ContactCategory)))->toBe('term_not_found');
    });
});

it('cherche par sens système et liste avec les surcharges, sans archivées ni masquées', function (): void {
    catalogueCreerValeur($this->org);
    catalogueCreerValeur($this->autre, 'autre_ramonage');
    $notaire = Term::query()->whereNull('organization_id')->where('key', 'notary')->firstOrFail();

    C::dans($this->org, function () use ($notaire): void {
        app(OverrideTerm::class)->handle($notaire, ['fr' => 'Étude notariale'], false, 99);
        $artisan = Term::query()->whereNull('organization_id')->where('key', 'craftsman')->firstOrFail();
        app(OverrideTerm::class)->handle($artisan, null, true, null);

        $entretien = $this->annuaire->bySemanticKey(VocabularyKey::ExpenseCategory, 'expense.maintenance');
        $contacts = $this->annuaire->list(VocabularyKey::ContactCategory);

        expect(array_map(fn (TermData $t): string => $t->key, $entretien))->toBe(['maintenance', 'ramonage'])
            ->and(array_map(fn (TermData $t): string => $t->key, $contacts))->toBe(['bailiff', 'syndic', 'insurer', 'accountant', 'other', 'notary'])
            ->and($contacts[5]->label())->toBe('Étude notariale')
            ->and($this->annuaire->bySemanticKey(VocabularyKey::LeaseComponent, 'rent'))->toHaveCount(1);
    });
});

it('résout plusieurs valeurs en deux requêtes, par identifiant, avec les mêmes données que find', function (): void {
    $propre = catalogueCreerValeur($this->org);
    $autreValeur = catalogueCreerValeur($this->org, 'ramonage_bis');
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'maintenance')->firstOrFail();

    C::dans($this->org, function () use ($propre, $autreValeur, $plateforme): void {
        $requetes = 0;
        DB::listen(function () use (&$requetes): void {
            $requetes++;
        });
        $trouvees = $this->annuaire->findMany([$propre->id, $autreValeur->id, $plateforme->id, $propre->id], VocabularyKey::ExpenseCategory);
        $comptees = $requetes;

        expect(array_keys($trouvees))->toEqualCanonicalizing([$propre->id, $autreValeur->id, $plateforme->id])
            ->and($trouvees[$propre->id])->toEqual($this->annuaire->find($propre->id, VocabularyKey::ExpenseCategory))
            ->and($trouvees[$plateforme->id]->isPlatform)->toBeTrue()
            ->and($comptees)->toBeLessThanOrEqual(2)
            ->and($this->annuaire->findMany([], VocabularyKey::ExpenseCategory))->toBe([]);
    });
});

it('refuse tout le lot par term_not_found dès qu\'une valeur est étrangère, d\'un autre référentiel ou inconnue', function (): void {
    $propre = catalogueCreerValeur($this->org);
    $etrangere = catalogueCreerValeur($this->autre);
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'bailiff')->firstOrFail();

    C::dans($this->org, function () use ($propre, $etrangere, $plateforme): void {
        expect(catalogueRefus(fn () => $this->annuaire->findMany([$propre->id, $etrangere->id], VocabularyKey::ExpenseCategory)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->findMany([$propre->id, $plateforme->id], VocabularyKey::ExpenseCategory)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->findMany([$propre->id, fake()->uuid()], VocabularyKey::ExpenseCategory)))->toBe('term_not_found')
            ->and(catalogueRefus(fn () => $this->annuaire->findMany([$propre->id, 'pas-un-uuid'], VocabularyKey::ExpenseCategory)))->toBe('term_not_found');
    });
});

it('exige un contexte d\'organisation pour résoudre plusieurs valeurs', function (): void {
    $plateforme = Term::query()->whereNull('organization_id')->where('key', 'bailiff')->firstOrFail();

    expect(fn () => $this->annuaire->findMany([$plateforme->id], VocabularyKey::ContactCategory))->toThrow(MissingOrganizationContext::class);
});
