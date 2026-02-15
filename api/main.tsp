import "@typespec/http";
import "./rest/api/dynamic-reporting.tsp";

using TypeSpec.Http;

@service(#{
  title: "Sanjaya Dynamic Reporting API",
})
namespace Rest.Api.V1;
