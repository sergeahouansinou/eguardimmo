<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\ImportStatement;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ImportFormat;
use App\Modules\Banking\Http\Requests\ImportStatementRequest;
use App\Modules\Banking\Http\Resources\BankStatementResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

final class ImportStatementController
{
    public function __invoke(ImportStatementRequest $request, string $account, ImportStatement $import): JsonResponse
    {
        $fichier = $request->file('file');

        if (! $fichier instanceof UploadedFile) {
            throw ErrorCode::StatementInvalid->problem();
        }

        $resultat = $import->handle(
            $account, $fichier->getRealPath() ?: '', ImportFormat::from((string) $request->validated('format')), $request->profile(), Actor::id($request), IdempotencyHeader::read($request),
        );

        return (new BankStatementResource($resultat['statement']))->additional(['meta' => ['rejected' => $resultat['rejected']]])->response()->setStatusCode($resultat['created'] ? 201 : 200);
    }
}
