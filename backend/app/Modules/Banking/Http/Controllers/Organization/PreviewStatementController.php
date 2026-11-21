<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\PreviewStatement;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Http\Requests\PreviewStatementRequest;
use App\Modules\Banking\Http\Resources\StatementPreviewResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

final class PreviewStatementController
{
    public function __invoke(PreviewStatementRequest $request, string $account, PreviewStatement $apercu): JsonResponse
    {
        $fichier = $request->file('file');

        if (! $fichier instanceof UploadedFile) {
            throw ErrorCode::StatementInvalid->problem();
        }

        $resultat = $apercu->handle($account, $fichier->getRealPath() ?: '', ImportFormat::from((string) $request->validated('format')), $request->profile());

        return (new StatementPreviewResource($resultat))->response();
    }
}
