<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Parties\PartiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->actingAs($this->titulaire);
});

function partiesCreer(object $test, object $org, array $corps): string
{
    return $test->postJson(C::url($org), $corps)->assertCreated()->json('data.id');
}

function partiesCode(Closure $appel): string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return 'aucune erreur';
}

it('lit une partie, son e-mail principal et ses catégories par sens, sans exposer de modèle', function (): void {
    $artisan = C::terme('contact_category', 'craftsman');
    $id = partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Ramonage du Port SARL', 'contact_category_ids' => [$artisan->id]]);
    $this->postJson(C::url($this->org, "/{$id}/contact-points"), ['type' => 'email', 'value' => 'contact@ramonage.fr'])->assertCreated();
    $this->postJson(C::url($this->org, "/{$id}/contact-points"), ['type' => 'email', 'value' => 'compta@ramonage.fr'])->assertCreated();

    $donnee = C::dans($this->org, fn () => app(PartyDirectory::class)->find($id));

    expect($donnee->id)->toBe($id)
        ->and($donnee->displayName)->toBe('Ramonage du Port SARL')
        ->and($donnee->kind)->toBe(PartyKind::Company)
        ->and($donnee->primaryEmail)->toBe('contact@ramonage.fr')
        ->and($donnee->categories)->toBe(['craftsman'])
        ->and($donnee->isAnonymized)->toBeFalse()
        ->and(C::dans($this->org, fn () => app(PartyDirectory::class)->primaryEmail($id)))->toBe('contact@ramonage.fr');
});

it('renvoie null sans e-mail principal', function (): void {
    $id = partiesCreer($this, $this->org, ['kind' => 'person', 'last_name' => 'Martin']);

    expect(C::dans($this->org, fn () => app(PartyDirectory::class)->primaryEmail($id)))->toBeNull();
});

it('refuse une partie d\'une autre organisation ou inconnue par party_not_found', function (): void {
    $partie = C::partie($this->org);
    $autre = C::organisation();

    foreach ([$partie->id, fake()->uuid(), 'pas-un-uuid'] as $id) {
        expect(partiesCode(fn () => C::dans($autre, fn () => app(PartyDirectory::class)->find($id))))->toBe('party_not_found')
            ->and(partiesCode(fn () => C::dans($autre, fn () => app(PartyDirectory::class)->primaryEmail($id))))->toBe('party_not_found');
    }

    expect(partiesCode(fn () => C::dans($this->org, fn () => app(PartyDirectory::class)->find($partie->id))))->toBe('aucune erreur');
});

it('retrouve le commissaire de justice par le sens bailiff, pas les autres catégories ni les fiches écartées', function (): void {
    $huissier = C::terme('contact_category', 'bailiff');
    $artisan = C::terme('contact_category', 'craftsman');

    $etude = partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Étude Martin Commissaires de justice', 'contact_category_ids' => [$huissier->id]]);
    $this->postJson(C::url($this->org, "/{$etude}/contact-points"), ['type' => 'email', 'value' => 'etude@martin-cj.fr'])->assertCreated();
    partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Ramonage', 'contact_category_ids' => [$artisan->id]]);
    partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Sans catégorie']);
    $archive = partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Ancienne étude', 'contact_category_ids' => [$huissier->id]]);
    $this->postJson(C::url($this->org, "/{$archive}/archive"))->assertOk();
    $anonyme = partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Étude fermée', 'contact_category_ids' => [$huissier->id]]);
    $this->postJson(C::url($this->org, "/{$anonyme}/anonymization"))->assertOk();

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre))->postJson(C::url($autre), ['kind' => 'company', 'company_name' => 'Étude voisine', 'contact_category_ids' => [$huissier->id]])->assertCreated();

    $trouves = C::dans($this->org, fn () => app(PartyDirectory::class)->withCategory(ContactCategorySemantic::Bailiff));

    expect($trouves)->toHaveCount(1)
        ->and($trouves[0]->id)->toBe($etude)
        ->and($trouves[0]->primaryEmail)->toBe('etude@martin-cj.fr')
        ->and($trouves[0]->categories)->toBe(['bailiff'])
        ->and(C::dans($this->org, fn () => app(PartyDirectory::class)->withCategory(ContactCategorySemantic::Insurer)))->toBe([]);
});

it('lit plusieurs parties en une fois, par identifiant, avec les mêmes données que find', function (): void {
    $artisan = C::terme('contact_category', 'craftsman');
    $premiere = partiesCreer($this, $this->org, ['kind' => 'company', 'company_name' => 'Ramonage du Port SARL', 'contact_category_ids' => [$artisan->id]]);
    $this->postJson(C::url($this->org, "/{$premiere}/contact-points"), ['type' => 'email', 'value' => 'contact@ramonage.fr'])->assertCreated();
    $seconde = partiesCreer($this, $this->org, ['kind' => 'person', 'last_name' => 'Martin']);

    $trouvees = C::dans($this->org, fn () => app(PartyDirectory::class)->findMany([$premiere, $seconde, $premiere]));
    $attendue = C::dans($this->org, fn () => app(PartyDirectory::class)->find($premiere));

    expect(array_keys($trouvees))->toEqualCanonicalizing([$premiere, $seconde])
        ->and($trouvees[$premiere])->toEqual($attendue)
        ->and($trouvees[$premiere]->primaryEmail)->toBe('contact@ramonage.fr')
        ->and($trouvees[$premiere]->categories)->toBe(['craftsman'])
        ->and($trouvees[$seconde]->primaryEmail)->toBeNull()
        ->and(C::dans($this->org, fn () => app(PartyDirectory::class)->findMany([])))->toBe([]);
});

it('lit plusieurs parties en un nombre de requêtes qui ne dépend pas du nombre de parties', function (): void {
    $ids = [];
    foreach (range(1, 6) as $i) {
        $ids[] = partiesCreer($this, $this->org, ['kind' => 'person', 'last_name' => "Dupont{$i}"]);
    }
    $compter = function (array $lot): int {
        return C::dans($this->org, function () use ($lot): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            app(PartyDirectory::class)->findMany($lot);
            $requetes = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $requetes;
        });
    };

    expect($compter($ids))->toBe($compter(array_slice($ids, 0, 2)));
});

it('refuse tout le lot par party_not_found dès qu\'une partie est étrangère ou inconnue', function (): void {
    $propre = C::partie($this->org);
    $autre = C::organisation();
    $etrangere = C::partie($autre);

    foreach ([$etrangere->id, fake()->uuid(), 'pas-un-uuid'] as $id) {
        expect(partiesCode(fn () => C::dans($this->org, fn () => app(PartyDirectory::class)->findMany([$propre->id, $id]))))->toBe('party_not_found');
    }
});
