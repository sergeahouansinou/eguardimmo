<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Models\TermOverride;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->etrangere = C::organisation();
    $this->etranger = C::titulaire($this->etrangere);

    $this->actingAs($this->titulaire);
    $this->termeAchive = $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), ['key' => 'ramonage', 'labels' => ['fr' => 'Ramonage'], 'semantic_key' => 'expense.maintenance'])
        ->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/terms/{$this->termeAchive}/archive"))->assertOk();
    $this->termePlateforme = Term::query()->whereNull('organization_id')->where('vocabulary', 'contact_category')->where('key', 'craftsman')->value('id');
    $this->putJson(C::url($this->org, "/terms/{$this->termePlateforme}/override"), ['labels' => ['fr' => 'Prestataire'], 'hidden' => false, 'position' => 10])->assertOk();
});

it('refuse la restauration d\'une valeur d\'une autre organisation sans la modifier', function (): void {
    C::changerDeCompte($this, $this->etranger)
        ->deleteJson(C::url($this->etrangere, "/terms/{$this->termeAchive}/archive"))
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');

    expect(DB::table('terms')->where('id', $this->termeAchive)->value('archived_at'))->not->toBeNull();
});

it('refuse de surcharger ou de réinitialiser une valeur d\'une autre organisation', function (): void {
    C::changerDeCompte($this, $this->etranger);

    $this->putJson(C::url($this->etrangere, "/terms/{$this->termeAchive}/override"), ['hidden' => true])->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->deleteJson(C::url($this->etrangere, "/terms/{$this->termeAchive}/override"))->assertNotFound()->assertJsonPath('code', 'term_not_found');

    expect(DB::table('term_overrides')->where('term_id', $this->termeAchive)->count())->toBe(0);
});

it('cloisonne la surcharge d\'une valeur de la plateforme par organisation', function (): void {
    C::changerDeCompte($this, $this->etranger)
        ->deleteJson(C::url($this->etrangere, "/terms/{$this->termePlateforme}/override"))
        ->assertOk()->assertJsonPath('data.overridden', false);

    $surcharges = DB::table('term_overrides')->where('term_id', $this->termePlateforme)->get();
    expect($surcharges)->toHaveCount(1)
        ->and($surcharges->first()->organization_id)->toBe($this->org->id);

    C::changerDeCompte($this, $this->titulaire)
        ->getJson(C::url($this->org, '/vocabularies/contact_category/terms'))
        ->assertJsonFragment(['key' => 'craftsman', 'overridden' => true]);
});

it('refuse de réordonner avec l\'identifiant d\'une valeur d\'une autre organisation', function (): void {
    C::changerDeCompte($this, $this->etranger);
    $propre = $this->postJson(C::url($this->etrangere, '/vocabularies/expense_category/terms'), ['key' => 'chez_etranger', 'labels' => ['fr' => 'X'], 'semantic_key' => 'expense.maintenance'])->json('data.id');
    $avant = $this->getJson(C::url($this->etrangere, '/vocabularies/expense_category/terms'))->json('data.*.key');

    $this->putJson(C::url($this->etrangere, '/vocabularies/expense_category/terms/order'), ['term_ids' => [$propre, $this->termeAchive]])
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');

    expect($this->getJson(C::url($this->etrangere, '/vocabularies/expense_category/terms'))->json('data.*.key'))->toBe($avant);

    C::changerDeCompte($this, $this->titulaire)
        ->putJson(C::url($this->org, '/vocabularies/expense_category/terms/order'), ['term_ids' => [$propre]])
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');
});

it('restaure bien une valeur de sa propre organisation', function (): void {
    $this->deleteJson(C::url($this->org, "/terms/{$this->termeAchive}/archive"))->assertOk()->assertJsonPath('data.archived', false);

    expect(Term::query()->where('id', $this->termeAchive)->exists())->toBeTrue()
        ->and(TermOverride::query()->count())->toBeGreaterThanOrEqual(1);
});
