<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Http\Controllers\Organization\ArchiveCustomFieldController;
use App\Modules\Catalog\Http\Controllers\Organization\ArchiveTermController;
use App\Modules\Catalog\Http\Controllers\Organization\CreateCustomFieldController;
use App\Modules\Catalog\Http\Controllers\Organization\CreateTagController;
use App\Modules\Catalog\Http\Controllers\Organization\CreateTermController;
use App\Modules\Catalog\Http\Controllers\Organization\DeleteTagController;
use App\Modules\Catalog\Http\Controllers\Organization\ListCustomFieldsController;
use App\Modules\Catalog\Http\Controllers\Organization\ListTagsController;
use App\Modules\Catalog\Http\Controllers\Organization\ListTermsController;
use App\Modules\Catalog\Http\Controllers\Organization\ListVocabulariesController;
use App\Modules\Catalog\Http\Controllers\Organization\OverrideTermController;
use App\Modules\Catalog\Http\Controllers\Organization\ReorderTermsController;
use App\Modules\Catalog\Http\Controllers\Organization\ResetTermOverrideController;
use App\Modules\Catalog\Http\Controllers\Organization\RestoreCustomFieldController;
use App\Modules\Catalog\Http\Controllers\Organization\RestoreTermController;
use App\Modules\Catalog\Http\Controllers\Organization\UpdateCustomFieldController;
use App\Modules\Catalog\Http\Controllers\Organization\UpdateTagController;
use App\Modules\Catalog\Http\Controllers\Organization\UpdateTermController;
use Illuminate\Support\Facades\Route;

$vocabulaires = implode('|', array_map(fn (VocabularyKey $v): string => $v->value, VocabularyKey::cases()));
$objets = implode('|', array_map(fn (CustomFieldEntity $e): string => $e->value, CustomFieldEntity::cases()));

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/catalog')->group(function () use ($vocabulaires, $objets): void {
    Route::middleware('organization')->group(function () use ($vocabulaires, $objets): void {
        Route::get('/vocabularies', ListVocabulariesController::class)->name('catalog.vocabularies.index');
        Route::get('/vocabularies/{vocabulary}/terms', ListTermsController::class)->where('vocabulary', $vocabulaires)->name('catalog.terms.index');
        Route::get('/custom-fields/{entity}', ListCustomFieldsController::class)->where('entity', $objets)->name('catalog.custom-fields.index');
        Route::get('/tags', ListTagsController::class)->name('catalog.tags.index');
    });

    Route::middleware(['organization:owner,admin', 'throttle:60,1'])->group(function () use ($vocabulaires, $objets): void {
        Route::post('/vocabularies/{vocabulary}/terms', CreateTermController::class)->where('vocabulary', $vocabulaires)->name('catalog.terms.store');
        Route::put('/vocabularies/{vocabulary}/terms/order', ReorderTermsController::class)->where('vocabulary', $vocabulaires)->name('catalog.terms.reorder');
        Route::patch('/terms/{term}', UpdateTermController::class)->whereUuid('term')->name('catalog.terms.update');
        Route::post('/terms/{term}/archive', ArchiveTermController::class)->whereUuid('term')->name('catalog.terms.archive');
        Route::delete('/terms/{term}/archive', RestoreTermController::class)->whereUuid('term')->name('catalog.terms.restore');
        Route::put('/terms/{term}/override', OverrideTermController::class)->whereUuid('term')->name('catalog.terms.override');
        Route::delete('/terms/{term}/override', ResetTermOverrideController::class)->whereUuid('term')->name('catalog.terms.override.reset');

        Route::post('/custom-fields/{entity}', CreateCustomFieldController::class)->where('entity', $objets)->name('catalog.custom-fields.store');
        Route::patch('/custom-fields/{field}', UpdateCustomFieldController::class)->whereUuid('field')->name('catalog.custom-fields.update');
        Route::post('/custom-fields/{field}/archive', ArchiveCustomFieldController::class)->whereUuid('field')->name('catalog.custom-fields.archive');
        Route::delete('/custom-fields/{field}/archive', RestoreCustomFieldController::class)->whereUuid('field')->name('catalog.custom-fields.restore');

        Route::post('/tags', CreateTagController::class)->name('catalog.tags.store');
        Route::put('/tags/{tag}', UpdateTagController::class)->whereUuid('tag')->name('catalog.tags.update');
        Route::delete('/tags/{tag}', DeleteTagController::class)->whereUuid('tag')->name('catalog.tags.destroy');
    });
});
